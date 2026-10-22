process.env.NODE_ENV = 'test';
process.env.OWNER_WHATSAPP_NUMBER = '5564999994321';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { createApp } = require('../src/http/app');

const admin = { id: 'usr-admin', name: 'Júnior', email: 'junior@conflora.test', role: 'ADMIN', pin: '0000' };
const cashierRose = { id: 'usr-rose', name: 'Rose', email: 'rose@conflora.test', role: 'CAIXA', pin: '1111' };
const cashierEdmar = { id: 'usr-edmar', name: 'Edmar', email: 'edmar@conflora.test', role: 'CAIXA', pin: '2222' };

function buildApp() {
  const repository = new FirestoreRepository({ isInMemory: true });
  repository.inMemoryUsers.set(admin.id, { ...admin, active: true });
  repository.inMemoryUsers.set(cashierRose.id, { ...cashierRose, active: true });
  repository.inMemoryUsers.set(cashierEdmar.id, { ...cashierEdmar, active: true });
  repository.inMemoryProducts.set('prod-1', { id: 'prod-1', name: 'Muda de Jabuticaba', price: 50, stockQuantity: 100, status: 'ATIVO' });
  repository.inMemoryCustomers.set('cust-1', { id: 'cust-1', name: 'Cliente Amigo', phone: '5564999112233', debtBalance: 0 });

  const sentWhatsApp = [];
  const whatsapp = {
    sendTextMessage: async (phone, text) => {
      sentWhatsApp.push({ phone, text });
      return { messages: [{ id: 'wamid.' + randomUUID() }] };
    },
    sendImageBuffer: async (phone, buffer, caption) => {
      sentWhatsApp.push({ phone, image: true, caption });
      return { messages: [{ id: 'wamid.' + randomUUID() }] };
    },
    sendDocumentBuffer: async (phone, buffer, filename, caption) => {
      sentWhatsApp.push({ phone, document: true, filename, caption });
      return { messages: [{ id: 'wamid.' + randomUUID() }] };
    },
  };

  const app = createApp({ repository, whatsappClient: whatsapp, messageService: { firestoreRepo: repository, whatsappClient: whatsapp } });
  return { app, repository, sentWhatsApp };
}

test('fluxo de fechamento de caixa: operador confere valores, anexa foto da maquininha, e resumo consolida e envia ao Júnior quando todos fecharem', async () => {
  const { app, sentWhatsApp } = buildApp();
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const post = (path, body, cookie = '') => fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    });
    const login = async (user) => {
      const res = await post('/api/admin/auth/login', { userId: user.id, pin: user.pin });
      assert.equal(res.status, 200);
      return res.headers.get('set-cookie').split(';')[0];
    };

    // 1. Login Rose
    const roseCookie = await login(cashierRose);

    // 2. Login Edmar
    const edmarCookie = await login(cashierEdmar);

    // 3. Criar e receber venda pela Rose (R$ 50 em dinheiro)
    const saleRose = await fetch(`${base}/api/caixa/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: roseCookie },
      body: JSON.stringify({
        requestId: randomUUID(),
        items: [{ productId: 'prod-1', quantity: 1 }],
        paymentMethod: 'DINHEIRO',
        cashReceived: 50,
      }),
    });
    assert.equal(saleRose.status, 200);

    // 4. Criar e receber venda pelo Edmar (R$ 100 em débito)
    const saleEdmar = await fetch(`${base}/api/caixa/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: edmarCookie },
      body: JSON.stringify({
        requestId: randomUUID(),
        items: [{ productId: 'prod-1', quantity: 2 }],
        paymentMethod: 'DEBITO',
      }),
    });
    assert.equal(saleEdmar.status, 200);

    // 5. Verificar closing-status para Rose
    const statusRose = await fetch(`${base}/api/caixa/closing-status`, {
      headers: { cookie: roseCookie },
    });
    assert.equal(statusRose.status, 200);
    const roseStatusData = await statusRose.json();
    assert.equal(roseStatusData.myClosing, null);
    assert.equal(roseStatusData.myExpected.cash, 50);
    assert.equal(roseStatusData.allClosed, false);

    // 6. Anexar foto da maquininha para o fechamento
    const proofResp = await fetch(`${base}/api/caixa/payment-proofs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: roseCookie },
      body: JSON.stringify({
        targetType: 'CLOSING',
        targetId: 'closing_' + roseStatusData.date,
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        fileName: 'relatorio-maquininha-rose.png',
      }),
    });
    assert.equal(proofResp.status, 201);
    const proofData = await proofResp.json();
    assert.ok(proofData.id);

    // 7. Rose fecha seu caixa
    const closeRose = await fetch(`${base}/api/caixa/close-my-cashier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: roseCookie },
      body: JSON.stringify({
        date: roseStatusData.date,
        counted: { cash: 50, pix: 0, credit: 0, debit: 0 },
        notes: 'Gaveta conferida perfeitamente.',
        proofId: proofData.id,
      }),
    });
    assert.equal(closeRose.status, 200);
    const closeRoseData = await closeRose.json();
    assert.equal(closeRoseData.success, true);
    assert.equal(closeRoseData.closing.status, 'CLOSED');
    assert.equal(closeRoseData.closing.differences.cash, 0);
    assert.equal(closeRoseData.allClosed, false);
    assert.equal(closeRoseData.whatsappSent, false);

    // 8. Tentar fechar novamente o caixa da Rose deve ser rejeitado (irreversível)
    const duplicateRose = await fetch(`${base}/api/caixa/close-my-cashier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: roseCookie },
      body: JSON.stringify({
        date: roseStatusData.date,
        counted: { cash: 50, pix: 0, credit: 0, debit: 0 },
      }),
    });
    assert.equal(duplicateRose.status, 409);

    // 9. Agora Edmar fecha seu caixa (comprovante anexado)
    const proofEdmar = await fetch(`${base}/api/caixa/payment-proofs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: edmarCookie },
      body: JSON.stringify({
        targetType: 'CLOSING',
        targetId: 'closing_' + roseStatusData.date,
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        fileName: 'relatorio-maquininha-edmar.png',
      }),
    });
    assert.equal(proofEdmar.status, 201);
    const edmarProofData = await proofEdmar.json();

    const closeEdmar = await fetch(`${base}/api/caixa/close-my-cashier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: edmarCookie },
      body: JSON.stringify({
        date: roseStatusData.date,
        counted: { cash: 0, pix: 0, credit: 0, debit: 100 },
        notes: 'Débito conferido na maquininha.',
        proofId: edmarProofData.id,
      }),
    });
    assert.equal(closeEdmar.status, 200);
    const closeEdmarData = await closeEdmar.json();
    assert.equal(closeEdmarData.success, true);
    assert.equal(closeEdmarData.allClosed, true);
    assert.equal(closeEdmarData.whatsappQueued, true);

    // 10. Verifica se a mensagem consolidada chegou ao WhatsApp do Júnior
    const juniorMessages = sentWhatsApp.filter((msg) => msg.phone === '5564999994321');
    assert.ok(juniorMessages.length >= 1, 'Resumo diário enviado ao WhatsApp do Júnior');
    const lastJuniorMsg = juniorMessages[juniorMessages.length - 1];
    assert.match(lastJuniorMsg.text, /FECHAMENTO GERAL DE TODOS OS CAIXAS/);
    assert.match(lastJuniorMsg.text, /Rose/);
    assert.match(lastJuniorMsg.text, /Edmar/);
    assert.match(lastJuniorMsg.text, /Total Conferido em Caixa/);
  } finally {
    server.close();
  }
});

test('conclusão de entrega envia automaticamente mensagem de agradecimento e link de avaliação no WhatsApp do cliente', async () => {
  const { app, repository, sentWhatsApp } = buildApp();
  const driver = { id: 'usr-driver', name: 'Entregador Rápido', email: 'driver@conflora.test', role: 'ENTREGADOR', pin: '9999' };
  repository.inMemoryUsers.set(driver.id, { ...driver, active: true });

  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const post = (path, body, cookie = '') => fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    });
    const login = async (user) => {
      const res = await post('/api/admin/auth/login', { userId: user.id, pin: user.pin });
      assert.equal(res.status, 200);
      return res.headers.get('set-cookie').split(';')[0];
    };

    const adminCookie = await login(admin);
    const driverCookie = await login(driver);

    // 1. Criar pedido com entrega
    const orderResp = await post('/api/caixa/orders', {
      requestId: randomUUID(),
      items: [{ productId: 'prod-1', quantity: 1 }],
      paymentMethod: 'DINHEIRO',
      cashReceived: 50,
      orderType: 'DELIVERY',
      customerName: 'Dona Maria',
      customerPhone: '64999554433',
      deliveryAddress: 'Rua das Flores, 123, Centro, Mineiros - GO',
    }, adminCookie);
    assert.equal(orderResp.status, 200);
    const orderData = await orderResp.json();
    const orderId = orderData.order ? orderData.order.id : orderData.id;

    // 2. Despachar entrega
    const dispatchResp = await post(`/api/caixa/deliveries/${orderId}/dispatch`, {}, adminCookie);
    assert.equal(dispatchResp.status, 200);

    // 3. Entregador aceita e inicia rota
    const acceptResp = await post(`/api/caixa/deliveries/${orderId}/accept`, {}, driverCookie);
    assert.equal(acceptResp.status, 200);

    const startResp = await post(`/api/caixa/deliveries/${orderId}/start`, {}, driverCookie);
    assert.equal(startResp.status, 200);

    // 4. Entregador recebe pagamento na entrega e conclui
    const receiveResp = await post(`/api/caixa/deliveries/${orderId}/receive`, {
      paymentMethod: 'DINHEIRO',
      cashReceived: 50,
    }, driverCookie);
    assert.equal(receiveResp.status, 200);

    const completeResp = await post(`/api/caixa/deliveries/${orderId}/complete`, {
      notes: 'Entregue em mãos para a Dona Maria',
      actualDistanceKm: 2.5,
    }, driverCookie);
    assert.equal(completeResp.status, 200);

    // 5. Verificar se mensagem de pedido concluído + agradecimento + link de avaliação foi enviada
    const customerMessages = sentWhatsApp.filter((msg) => msg.phone === '5564999554433');
    if (!customerMessages.some((msg) => msg.text && msg.text.includes('PEDIDO CONCLUÍDO'))) {
      console.log('ALL SENT WHATSAPP:', JSON.stringify(sentWhatsApp, null, 2));
    }
    assert.ok(customerMessages.length >= 1, 'Mensagem enviada para o cliente');
    const completionMsg = customerMessages.find((msg) => msg.text && msg.text.includes('PEDIDO CONCLUÍDO'));
    assert.ok(completionMsg, 'Mensagem de PEDIDO CONCLUÍDO localizada');
    assert.match(completionMsg.text, /Muito obrigado pela sua preferência e confiança/);
    assert.match(completionMsg.text, /Avalie o nosso atendimento/);
    assert.match(completionMsg.text, /#feedback-/);
  } finally {
    server.close();
  }
});
