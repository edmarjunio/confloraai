process.env.NODE_ENV = 'test';
process.env.PIX_MODE = 'SICREDI';
process.env.OWNER_WHATSAPP_NUMBER = '5564999994321';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { SicrediPixClient } = require('../src/integrations/sicredi-pix.client');
const { createApp } = require('../src/http/app');

function createTestEnvironment() {
  const firestoreRepo = new FirestoreRepository({ isInMemory: true });

  // Cadastra produto real no banco (Firestore em memória) com preço R$ 45,00 e estoque 10
  firestoreRepo.inMemoryProducts.set('muda-ipe', {
    id: 'muda-ipe',
    name: 'Muda de Ipê Amarelo',
    price: 45.0,
    stockQuantity: 10,
    reservedQuantity: 0,
    unit: 'UN',
    status: 'ATIVO',
    isAvailable: true,
  });

  const whatsappMessages = [];
  const whatsappClient = {
    sendTextMessage: async (phone, text) => {
      whatsappMessages.push({ type: 'text', phone, text });
      return { messages: [{ id: `wamid.txt.${whatsappMessages.length}` }] };
    },
    sendImageBuffer: async (phone, buffer, caption) => {
      whatsappMessages.push({
        type: 'image',
        phone,
        caption,
        sizeBytes: buffer.length,
      });
      return { messages: [{ id: `wamid.img.${whatsappMessages.length}` }] };
    },
  };

  const sicrediApiCalls = [];
  const pixKey = '52998224725';

  // Instancia o SicrediPixClient real interceptando apenas o transporte HTTPS mTLS
  const sicrediClient = new SicrediPixClient({
    clientId: 'client-id-conflora',
    clientSecret: 'client-secret-conflora',
    certificate: '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----',
    privateKey: '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----',
    pixKey,
    beneficiario: 'Conflora Horta e Viveiro',
    cidade: 'Mineiros',
    request: async (url, options) => {
      const parsedBody = options.body && options.headers?.['Content-Type'] === 'application/json'
        ? JSON.parse(options.body)
        : options.body;
      sicrediApiCalls.push({ url, method: options.method, body: parsedBody, headers: options.headers });

      // 1. Endpoint OAuth2 Token
      if (url.includes('/oauth/token')) {
        return { access_token: 'sicredi-mtls-oauth-token', expires_in: 3600 };
      }

      // 2. Endpoint de Criação de Cobrança Imediata (PUT /cob/:txid)
      if (options.method === 'PUT' && url.includes('/cob/')) {
        const txid = decodeURIComponent(url.split('/cob/')[1]);
        return {
          txid,
          chave: pixKey,
          status: 'ATIVA',
          calendario: { criacao: new Date().toISOString(), expiracao: parsedBody.calendario.expiracao },
          valor: {
            original: parsedBody.valor.original,
            modalidadeAlteracao: parsedBody.valor.modalidadeAlteracao,
          },
          solicitacaoPagador: parsedBody.solicitacaoPagador,
          pixCopiaECola: `00020101021226850014br.gov.bcb.pix2563pix.sicredi.com.br/qr/v2/${txid}5204000053039865405${parsedBody.valor.original}5802BR5924Conflora Horta e Viveiro6008Mineiros6304ABCD`,
        };
      }

      // 3. Endpoint de Consulta de PIX Recebido (GET /pix/:endToEndId)
      if (options.method === 'GET' && url.includes('/pix/')) {
        const endToEndId = decodeURIComponent(url.split('/pix/')[1]);
        const lastCob = sicrediApiCalls.find((c) => c.method === 'PUT' && c.url.includes('/cob/'));
        const txid = lastCob ? decodeURIComponent(lastCob.url.split('/cob/')[1]) : '';
        return {
          endToEndId,
          txid,
          valor: lastCob ? lastCob.body.valor.original : '90.00',
          chave: pixKey,
          horario: new Date().toISOString(),
          devolucoes: [],
        };
      }

      throw new Error(`Rota Sicredi não esperada no teste: ${options.method} ${url}`);
    },
  });

  const taskQueueClient = {
    enqueuePixExpiration: async (orderId, ttlSeconds) => ({ orderId, ttlSeconds }),
  };

  const app = createApp({
    messageService: { firestoreRepo, whatsappClient },
    taskQueueClient,
    sicrediClient,
  });

  return { firestoreRepo, whatsappClient, whatsappMessages, sicrediClient, sicrediApiCalls, app };
}

test('Fluxo Completo PIX Sicredi: 1) QR Code com valor travado no backend -> 2) Recepção de Webhook -> 3) Atualização de status e estoque no Firebase', async (t) => {
  const previousSecret = process.env.SICREDI_WEBHOOK_SECRET;
  const webhookSecret = 'segredo-webhook-sicredi-conflora-2026-valido-32chars';
  process.env.SICREDI_WEBHOOK_SECRET = webhookSecret;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.SICREDI_WEBHOOK_SECRET;
    else process.env.SICREDI_WEBHOOK_SECRET = previousSecret;
  });

  const { firestoreRepo, whatsappMessages, sicrediApiCalls, app } = createTestEnvironment();
  const server = app.listen(0);
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // =========================================================================
  // ETAPA 1: Geração do Pedido e QR Code com Valor Travado no Backend
  // =========================================================================
  // Tentativa de envio com preço adulterado no payload (R$ 1,00 em vez de R$ 45,00)
  // O backend deve ignorar o preço do cliente e travar 2x R$ 45,00 = R$ 90,00.
  const checkoutRes = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `idem-${randomUUID()}`,
    },
    body: JSON.stringify({
      customerName: 'Maria Oliveira',
      customerPhone: '64999112233',
      orderType: 'PICKUP',
      paymentMethod: 'PIX',
      items: [
        { productId: 'muda-ipe', quantity: 2, price: 1.0 },
      ],
    }),
  });

  assert.equal(checkoutRes.status, 200, 'O pedido deve ser criado com sucesso');
  const checkoutBody = await checkoutRes.json();
  assert.equal(checkoutBody.success, true);

  const createdOrder = checkoutBody.order;
  assert.equal(createdOrder.total, 90.0, 'O valor deve ser calculado e travado pelo backend (2x R$ 45,00 = R$ 90,00)');
  assert.equal(createdOrder.status, 'AWAITING_PIX', 'Status inicial deve ser AWAITING_PIX');
  assert.equal(createdOrder.paymentStatus, 'PENDING', 'Status de pagamento inicial deve ser PENDING');
  assert.equal(createdOrder.pixMode, 'SICREDI');
  assert.ok(createdOrder.pixData?.txid, 'Deve conter um txid gerado para o Sicredi');
  assert.equal(createdOrder.pixData?.mode, 'API_SICREDI_FIXED_AMOUNT', 'Modalidade deve ser valor fixo na API Sicredi');
  assert.match(createdOrder.pixData?.qrCodeBase64, /^data:image\/png;base64,/, 'Deve retornar QR Code em Base64');
  assert.ok(createdOrder.pixData?.pixCopiaECola.includes('540590.00'), 'Pix Copia e Cola deve conter o valor travado de 90.00');

  // Verifica chamada enviada ao Sicredi (PUT /cob/:txid)
  const cobCall = sicrediApiCalls.find((c) => c.method === 'PUT' && c.url.includes('/cob/'));
  assert.ok(cobCall, 'Deve ter chamado PUT /cob/:txid na API do Sicredi');
  assert.equal(cobCall.body.valor.original, '90.00', 'Valor enviado ao Sicredi deve ser exatamente 90.00');
  assert.equal(cobCall.body.valor.modalidadeAlteracao, 0, 'modalidadeAlteracao deve ser 0 (impede o pagador de alterar o valor)');

  // Verifica estado no Firebase (Firestore) antes do Webhook: estoque reservado, não baixado em definitivo
  const productBeforeWebhook = firestoreRepo.inMemoryProducts.get('muda-ipe');
  assert.equal(productBeforeWebhook.stockQuantity, 10, 'Estoque físico permanece 10 enquanto aguarda pagamento');
  assert.equal(productBeforeWebhook.reservedQuantity, 2, '2 unidades devem estar reservadas no Firestore');

  const storedOrderBefore = await firestoreRepo.getOrderById(createdOrder.id);
  assert.equal(storedOrderBefore.status, 'AWAITING_PIX');
  assert.equal(storedOrderBefore.paymentStatus, 'PENDING');

  // =========================================================================
  // ETAPA 2: Recepção do Payload via Webhook do Sicredi
  // =========================================================================
  const txid = createdOrder.pixData.txid;
  const endToEndId = 'E' + '9'.repeat(31);

  // 2.1 Teste de segurança: requisição sem segredo/certificado deve ser bloqueada com 401
  const unauthorizedWebhook = await fetch(`${baseUrl}/webhooks/sicredi-pix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pix: [{ txid, endToEndId }] }),
  });
  assert.equal(unauthorizedWebhook.status, 401, 'Webhook sem credencial válida deve retornar HTTP 401');

  // 2.2 Disparo oficial autenticado do Webhook do Sicredi
  const validWebhook = await fetch(`${baseUrl}/webhooks/sicredi-pix/${webhookSecret}/pix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pix: [
        {
          endToEndId,
          txid,
          valor: '90.00',
          horario: new Date().toISOString(),
        },
      ],
    }),
  });
  assert.equal(validWebhook.status, 200, 'Webhook autenticado deve responder HTTP 200');

  // Confirma que o backend fez a dupla conferência ativa no Sicredi (GET /pix/:endToEndId)
  const pixCheckCall = sicrediApiCalls.find((c) => c.method === 'GET' && c.url.includes(`/pix/${endToEndId}`));
  assert.ok(pixCheckCall, 'Backend deve consultar GET /pix/:endToEndId no Sicredi antes de aprovar');

  // =========================================================================
  // ETAPA 3: Verificação da Atualização no Firebase (Firestore)
  // =========================================================================
  const updatedOrder = await firestoreRepo.getOrderById(createdOrder.id);
  assert.equal(updatedOrder.status, 'CONFIRMED', 'Status do pedido no Firestore deve ser atualizado para CONFIRMED');
  assert.equal(updatedOrder.paymentStatus, 'APPROVED', 'paymentStatus no Firestore deve ser atualizado para APPROVED');
  assert.equal(updatedOrder.verifiedVia, 'SICREDI_PIX_WEBHOOK', 'Origem da verificação deve ser SICREDI_PIX_WEBHOOK');
  assert.equal(updatedOrder.paymentTransactionId, endToEndId, 'Deve gravar o endToEndId da transação');
  assert.ok(updatedOrder.paidAt, 'Deve preencher data/hora de pagamento (paidAt)');
  assert.ok(updatedOrder.completedAt, 'Deve preencher data/hora de conclusão (completedAt)');

  // Verifica que o evento do webhook ficou registrado como DONE no Firestore
  const eventDoc = await app.locals.pdv.store.read('pdv_pix_events', `${txid}-${endToEndId}`);
  assert.equal(eventDoc?.status, 'DONE', 'Evento do Webhook deve ser marcado como DONE na coleção pdv_pix_events');

  // Verifica baixa definitiva do estoque e liberação da reserva no Firestore
  const productAfterWebhook = firestoreRepo.inMemoryProducts.get('muda-ipe');
  assert.equal(productAfterWebhook.stockQuantity, 8, 'Estoque físico deve cair de 10 para 8 após confirmação do PIX');
  assert.equal(productAfterWebhook.reservedQuantity, 0, 'Reserva de estoque deve ser zerada após baixa definitiva');

  // Verifica idempotência: se o Sicredi reenviar o mesmo Webhook, nada é duplicado
  const duplicateWebhook = await fetch(`${baseUrl}/webhooks/sicredi-pix/${webhookSecret}/pix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pix: [{ endToEndId, txid, valor: '90.00' }] }),
  });
  assert.equal(duplicateWebhook.status, 200);
  assert.equal(firestoreRepo.inMemoryProducts.get('muda-ipe').stockQuantity, 8, 'Reenvio de webhook não pode baixar estoque duas vezes');

  // Verifica envio de notificações WhatsApp (QR Code na criação + Comprovante de PIX aprovado após Webhook)
  assert.ok(whatsappMessages.some((m) => m.type === 'image' && m.caption.includes(createdOrder.pixData.pixCopiaECola)), 'Deve ter enviado a imagem do QR Code PIX');
  assert.ok(whatsappMessages.some((m) => m.type === 'text' && /PIX CONFIRMADO|PAGAMENTO CONFIRMADO/i.test(m.text)), 'Deve ter enviado confirmação de pagamento PIX no WhatsApp');
});

test('Endpoint de Simulação Admin (POST /api/admin/sicredi-pix/simulate) valida as 3 etapas em sandbox isolado', async (t) => {
  const { firestoreRepo, app } = createTestEnvironment();
  firestoreRepo.inMemoryUsers.set('admin-sim', {
    id: 'admin-sim',
    name: 'Admin Conflora',
    email: 'admin@conflora.test',
    role: 'ADMIN',
    pin: '9999',
    active: true,
  });

  const server = app.listen(0);
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Autentica como ADMIN
  const loginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'admin-sim', pin: '9999' }),
  });
  assert.equal(loginRes.status, 200);
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  // Executa a simulação completa do fluxo PIX Sicredi
  const simRes = await fetch(`${baseUrl}/api/admin/sicredi-pix/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ productName: 'Palmeira Imperial', unitPrice: 60, quantity: 3 }),
  });
  assert.equal(simRes.status, 200);
  const report = await simRes.json();

  assert.equal(report.success, true);
  assert.equal(report.isolatedSandbox, true);

  // Etapa 1: QR Code com valor travado
  assert.equal(report.steps.step1_qrCodeGeneration.lockedAmount, 180);
  assert.equal(report.steps.step1_qrCodeGeneration.modalidadeAlteracao, 0);
  assert.equal(report.steps.step1_qrCodeGeneration.hasQrCodeBase64, true);
  assert.equal(report.steps.step1_qrCodeGeneration.statusBeforeWebhook, 'AWAITING_PIX');
  assert.equal(report.steps.step1_qrCodeGeneration.stockBeforeWebhook.reservedQuantity, 3);

  // Etapa 2: Recepção do Webhook e conferência bancária
  assert.equal(report.steps.step2_webhookReception.bankCheckPerformed, true);
  assert.equal(report.steps.step2_webhookReception.eventStatus, 'DONE');

  // Etapa 3: Atualização no Firebase
  assert.equal(report.steps.step3_firebaseUpdate.statusAfterWebhook, 'CONFIRMED');
  assert.equal(report.steps.step3_firebaseUpdate.paymentStatusAfterWebhook, 'APPROVED');
  assert.equal(report.steps.step3_firebaseUpdate.verifiedVia, 'SICREDI_PIX_WEBHOOK');
  assert.equal(report.steps.step3_firebaseUpdate.stockAfterWebhook.reservedQuantity, 0);
  assert.equal(report.steps.step3_firebaseUpdate.stockAfterWebhook.stockQuantity, 8);
});

test('Painel /admin Monitor PIX Sicredi: lista pedidos pendente/confirmado/expirado e permite simular Webhook sem tokens', async (t) => {
  const { firestoreRepo, app } = createTestEnvironment();
  firestoreRepo.inMemoryUsers.set('admin-mon', {
    id: 'admin-mon',
    name: 'Admin Monitor',
    email: 'admin-mon@conflora.test',
    role: 'ADMIN',
    pin: '1234',
    active: true,
  });

  const server = app.listen(0);
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Verifica que o HTML do /admin inclui a seção do Monitor PIX, contador visual, filtro de data e botões de exportação
  const adminHtmlRes = await fetch(`${baseUrl}/admin`);
  assert.equal(adminHtmlRes.status, 200);
  const adminHtml = await adminHtmlRes.text();
  assert.ok(adminHtml.includes('sicrediPixMonitorSection'), 'HTML do /admin deve conter o painel sicrediPixMonitorSection');
  assert.ok(adminHtml.includes('Monitor de Pagamentos PIX (Sicredi)'), 'HTML do /admin deve exibir o título do Monitor PIX Sicredi');
  assert.ok(adminHtml.includes('pixPendingVsConfirmedWidget'), 'HTML do /admin deve conter o contador visual de pendentes vs confirmados');
  assert.ok(adminHtml.includes('btnExportPixCsv'), 'HTML do /admin deve conter o botão de exportação CSV');
  assert.ok(adminHtml.includes('btnExportPixPdf'), 'HTML do /admin deve conter o botão de exportação PDF');
  assert.ok(adminHtml.includes('pixMonitorDateFrom'), 'HTML do /admin deve conter o filtro de data inicial');

  // Autentica como ADMIN
  const loginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'admin-mon', pin: '1234' }),
  });
  assert.equal(loginRes.status, 200);
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  // 1. Cria 2 pedidos PIX de teste pelo simulador do painel /admin (sem precisar de tokens reais)
  const order1Res = await fetch(`${baseUrl}/api/admin/sicredi-pix/simulate-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ customerName: 'Cliente PIX 1', unitPrice: 75, quantity: 2 }),
  });
  assert.equal(order1Res.status, 201);
  const order1Data = await order1Res.json();
  assert.equal(order1Data.order.pixStatus, 'pendente');
  assert.equal(order1Data.order.pixAmount, 150);
  assert.equal(order1Data.cobRequest.payload.valor.modalidadeAlteracao, 0);

  const order2Res = await fetch(`${baseUrl}/api/admin/sicredi-pix/simulate-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ customerName: 'Cliente PIX 2', unitPrice: 50, quantity: 1 }),
  });
  assert.equal(order2Res.status, 201);
  const order2Data = await order2Res.json();
  assert.equal(order2Data.order.pixStatus, 'pendente');

  // 2. Consulta o monitor PIX: deve exibir 2 pedidos com status 'pendente'
  const listBeforeRes = await fetch(`${baseUrl}/api/admin/sicredi-pix/orders`, {
    headers: { cookie },
  });
  assert.equal(listBeforeRes.status, 200);
  const listBefore = await listBeforeRes.json();
  assert.equal(listBefore.summary.pendente, 2);
  assert.equal(listBefore.summary.confirmado, 0);
  assert.equal(listBefore.summary.expirado, 0);
  assert.equal(listBefore.summary.pendentesVsConfirmados.pendente, 2);
  assert.equal(listBefore.summary.pendentesVsConfirmados.confirmado, 0);
  assert.equal(listBefore.summary.pendentesVsConfirmados.pendentePercent, 100);

  // 3. Simula a chegada do Webhook de pagamento aprovado para o Pedido 1
  const whConfirmRes = await fetch(`${baseUrl}/api/admin/sicredi-pix/simulate-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ orderId: order1Data.order.id, action: 'confirm' }),
  });
  assert.equal(whConfirmRes.status, 200);
  const whConfirm = await whConfirmRes.json();
  assert.equal(whConfirm.before.pixStatus, 'pendente');
  assert.equal(whConfirm.after.pixStatus, 'confirmado');
  assert.equal(whConfirm.after.verifiedVia, 'SICREDI_PIX_WEBHOOK');
  assert.ok(Array.isArray(whConfirm.webhookPayload.pix));

  // 4. Simula a expiração de prazo (TTL) para o Pedido 2
  const whExpireRes = await fetch(`${baseUrl}/api/admin/sicredi-pix/simulate-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ orderId: order2Data.order.id, action: 'expire' }),
  });
  assert.equal(whExpireRes.status, 200);
  const whExpire = await whExpireRes.json();
  assert.equal(whExpire.before.pixStatus, 'pendente');
  assert.equal(whExpire.after.pixStatus, 'expirado');

  // 5. Cria um 3º pedido para termos 1 pendente, 1 confirmado e 1 expirado no painel /admin
  await fetch(`${baseUrl}/api/admin/sicredi-pix/simulate-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ customerName: 'Cliente PIX 3', unitPrice: 40, quantity: 1 }),
  });

  const listAfterRes = await fetch(`${baseUrl}/api/admin/sicredi-pix/orders`, {
    headers: { cookie },
  });
  const listAfter = await listAfterRes.json();
  assert.equal(listAfter.summary.total, 3);
  assert.equal(listAfter.summary.pendente, 1);
  assert.equal(listAfter.summary.confirmado, 1);
  assert.equal(listAfter.summary.expirado, 1);

  // Verifica o contador visual Pendentes vs Confirmados via Firestore
  assert.equal(listAfter.summary.pendentesVsConfirmados.pendente, 1);
  assert.equal(listAfter.summary.pendentesVsConfirmados.confirmado, 1);
  assert.equal(listAfter.summary.pendentesVsConfirmados.activeTotal, 2);
  assert.equal(listAfter.summary.pendentesVsConfirmados.pendentePercent, 50);
  assert.equal(listAfter.summary.pendentesVsConfirmados.confirmadoPercent, 50);
  assert.equal(listAfter.summary.pendentesVsConfirmados.pendenteValor, 40);
  assert.equal(listAfter.summary.pendentesVsConfirmados.confirmadoValor, 150);

  // 6. Testa o filtro por data (?date=YYYY-MM-DD)
  const todayIso = listAfter.orders[0].businessDate;
  const filteredTodayRes = await fetch(`${baseUrl}/api/admin/sicredi-pix/orders?date=${todayIso}`, {
    headers: { cookie },
  });
  const filteredToday = await filteredTodayRes.json();
  assert.equal(filteredToday.summary.total, 3, 'Filtro da data de hoje deve retornar os 3 pedidos');

  const filteredOtherDateRes = await fetch(`${baseUrl}/api/admin/sicredi-pix/orders?date=2099-12-31`, {
    headers: { cookie },
  });
  const filteredOtherDate = await filteredOtherDateRes.json();
  assert.equal(filteredOtherDate.summary.total, 0, 'Filtro de data futura sem pedidos deve retornar 0');

  // 7. Testa a exportação de Conciliação Bancária em CSV e PDF
  const csvRes = await fetch(`${baseUrl}/api/admin/sicredi-pix/export.csv?date=${todayIso}`, {
    headers: { cookie },
  });
  assert.equal(csvRes.status, 200);
  assert.match(csvRes.headers.get('content-type') || '', /text\/csv/i);
  const csvText = await csvRes.text();
  assert.ok(csvText.includes('Status_PIX;Status_Sistema;Modo_PIX;Valor_PIX_BRL;Modalidade_Alteracao;TXID_Sicredi;EndToEndId_Bacen'), 'CSV deve conter cabeçalho de conciliação bancária');
  assert.ok(csvText.includes('Cliente PIX 1'), 'CSV deve listar o Cliente PIX 1');
  assert.ok(csvText.includes('CONFIRMADO'), 'CSV deve incluir status CONFIRMADO');

  const pdfRes = await fetch(`${baseUrl}/api/admin/sicredi-pix/export.pdf?date=${todayIso}`, {
    headers: { cookie },
  });
  assert.equal(pdfRes.status, 200);
  assert.match(pdfRes.headers.get('content-type') || '', /application\/pdf/i);
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  assert.equal(pdfBuffer.subarray(0, 4).toString('ascii'), '%PDF', 'Arquivo exportado deve ser um PDF válido');
});



