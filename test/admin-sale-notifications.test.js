process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { createApp } = require('../src/http/app');

test('ADMIN NOTIFICATIONS: Notifica todos os usuários com papel ADMIN quando uma venda é finalizada', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });

  // Cria mais um admin e um caixa
  await repo.saveUser({
    id: 'usr-admin2',
    name: 'Admin Secundário',
    email: 'admin2@conflora.com.br',
    role: 'ADMIN',
    active: true,
  });

  await repo.saveUser({
    id: 'usr-caixa99',
    name: 'Atendente Caixa 99',
    email: 'caixa99@conflora.com.br',
    role: 'CAIXA',
    active: true,
  });

  const sampleOrder = {
    id: 'ord-test-999',
    customerName: 'Maria Silva',
    customerPhone: '5564999990000',
    total: 150.0,
    paymentMethod: 'PIX',
    source: 'WEB_CATALOG',
    items: [
      { name: 'Muda de Jabuticaba', price: 75.0, quantity: 2 },
    ],
  };

  const createdNotifs = await repo.notifyAllAdminUsersOfSale(sampleOrder);
  assert.ok(Array.isArray(createdNotifs));
  assert.ok(createdNotifs.length >= 2, 'Deve notificar pelo menos 2 administradores cadastrados');

  // Verifica se o admin primário (usr-edmar) e o admin secundário receberam a notificação
  const edmarNotifs = await repo.getUserNotifications('usr-edmar');
  const admin2Notifs = await repo.getUserNotifications('usr-admin2');
  const caixaNotifs = await repo.getUserNotifications('usr-caixa99');

  const edmarSaleNotif = edmarNotifs.find(n => n.type === 'SALE_COMPLETED' && n.orderId === 'ord-test-999');
  const admin2SaleNotif = admin2Notifs.find(n => n.type === 'SALE_COMPLETED' && n.orderId === 'ord-test-999');
  const caixaSaleNotif = caixaNotifs.find(n => n.type === 'SALE_COMPLETED' && n.orderId === 'ord-test-999');

  assert.ok(edmarSaleNotif, 'Admin usr-edmar deve ter recebido a notificação da venda');
  assert.ok(admin2SaleNotif, 'Admin usr-admin2 deve ter recebido a notificação da venda');
  assert.equal(caixaSaleNotif, undefined, 'Usuário CAIXA não deve receber notificação exclusiva de ADMIN');

  assert.ok(edmarSaleNotif.title.includes('Nova Venda Finalizada'));
  assert.ok(edmarSaleNotif.message.includes('150,00'));
  assert.ok(edmarSaleNotif.message.includes('Maria Silva'));
});

test('ADMIN NOTIFICATIONS: POST /api/orders dispara notificação para todos os administradores', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });
  await repo.saveProduct({ id: 'p10', name: 'Planta Teste', price: 80, stockQuantity: 10 });
  await repo.saveUser({
    id: 'usr-admin-store',
    name: 'Admin Loja',
    email: 'adminloja@conflora.com.br',
    role: 'ADMIN',
    active: true,
  });

  const app = createApp({ messageService: { firestoreRepo: repo } });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Cliente Notif Admin Teste',
        customerPhone: '5564998877665',
        orderType: 'PICKUP',
        paymentMethod: 'DINHEIRO',
        subtotal: 80.0,
        items: [
          { productId: 'p10', name: 'Planta Teste', quantity: 1, price: 80.0 },
        ],
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);

    const adminNotifs = await repo.getUserNotifications('usr-admin-store');
    const orderNotif = adminNotifs.find(n => n.type === 'SALE_COMPLETED' && n.orderId === data.order.id);
    assert.ok(orderNotif, 'Admin deve receber a notificação do pedido web recém-criado');
    assert.equal(orderNotif.orderTotal, 80);
    assert.equal(orderNotif.customerName, 'Cliente Notif Admin Teste');
  } finally {
    server.close();
  }
});

test('ADMIN NOTIFICATIONS: POST /api/admin/orders/manual dispara notificação para administradores', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });
  await repo.saveProduct({ id: 'p20', name: 'Adubo Orgânico', price: 25, stockQuantity: 10 });
  const app = createApp({ messageService: { firestoreRepo: repo } });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    // Autentica como Edmar Júnio (ADMIN) via PIN para obter o cookie de sessão
    const loginRes = await fetch(`http://127.0.0.1:${port}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr-edmar', pin: '1234' }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];

    const res = await fetch(`http://127.0.0.1:${port}/api/admin/orders/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie,
      },
      body: JSON.stringify({
        customerName: 'Comprador Balcão Presencial',
        customerPhone: '64999991122',
        paymentMethod: 'DINHEIRO',
        items: [
          { productId: 'p20', name: 'Adubo Orgânico', quantity: 2, price: 25.0 },
        ],
        notes: 'Venda presencial no viveiro',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);

    const edmarNotifs = await repo.getUserNotifications('usr-edmar');
    const saleNotif = edmarNotifs.find(n => n.type === 'SALE_COMPLETED' && n.orderId === data.order.id);
    assert.ok(saleNotif, 'Admin deve receber notificação de venda manual finalizada');
    assert.equal(saleNotif.orderTotal, 50);
  } finally {
    server.close();
  }
});

test('WHATSAPP: OrderService.confirmOrder registra pedido pendente e recibo durável', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });
  const { OrderService } = require('../src/orders/order.service');
  const catalogRepo = { items: [] };
  const orderService = new OrderService({ firestoreRepo: repo, catalogRepo });

  await repo.saveProduct({ id: 'ipe', name: 'Ipê Amarelo', price: 45, stockQuantity: 10, status: 'ATIVO' });
  const pendingOrder = await orderService.createPendingOrder('5564999112233', [
    { product: { id: 'ipe' }, quantity: 2 },
  ], {
    deliveryAddress: 'Rua das Flores, 123',
    paymentMethod: 'DINHEIRO',
  });
  assert.ok(pendingOrder);

  const confirmResult = await orderService.confirmOrder('5564999112233', 'Dona Florinda');
  assert.ok(confirmResult);

  assert.equal(confirmResult.order.source, 'WHATSAPP_BOT');
  assert.equal(confirmResult.order.customerName, 'Dona Florinda');
  assert.equal(confirmResult.order.total, 90);
  assert.equal(confirmResult.order.paymentStatus, 'PENDING');
  assert.ok(repo.pdvMemory.get('pdv_outbox').has(confirmResult.order.id + '-receipt'));
});

test('CAIXA DISCOUNTS: desconto acima de 5% aguarda Admin e só vira pedido após aceite', async (t) => {
  const repo = new FirestoreRepository({ isInMemory: true });
  const config = require('../src/config/env');
  const previousServiceUrl = config.tasks.serviceUrl;
  config.tasks.serviceUrl = 'https://conflora.example';
  t.after(() => { config.tasks.serviceUrl = previousServiceUrl; });
  const createDirectOrder = repo.createDirectOrder.bind(repo);
  repo.createDirectOrder = (data) => createDirectOrder(data);
  await repo.saveProduct({ id: 'discount-plant', name: 'Muda de Teste', price: 100, stockQuantity: 10, status: 'ATIVO' });
  const app = createApp({ messageService: { firestoreRepo: repo }, sicrediClient: { createCharge: async ({ txid, amount }) => ({ txid, amount, pixCopiaECola: 'test-code', qrCodeBase64: 'data:image/png;base64,aGVsbG8=' }) } });
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function login(userId, pin) {
    const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, pin }),
    });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie')?.split(';')[0];
  }

  try {
    const anonymousSale = await fetch(`${baseUrl}/api/caixa/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: require('node:crypto').randomUUID(),
        items: [{ productId: 'discount-plant', quantity: 1 }],
        paymentMethod: 'DINHEIRO',
      }),
    });
    assert.equal(anonymousSale.status, 401);

    const cashierCookie = await login('usr-caixa1', '0000');
    const saleResponse = await fetch(`${baseUrl}/api/caixa/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cashierCookie },
      body: JSON.stringify({
        requestId: require('node:crypto').randomUUID(),
        items: [{ productId: 'discount-plant', price: 1, quantity: 1 }],
        paymentMethod: 'PIX',
        customerName: 'Cliente Teste',
        discountPercent: 10,
      }),
    });
    assert.equal(saleResponse.status, 202);
    const pending = await saleResponse.json();
    assert.equal(pending.approvalRequired, true);
    assert.equal((await repo.getAllOrders(100)).some((order) => order.customerName === 'Cliente Teste'), false);

    const adminCookie = await login('usr-edmar', '1234');
    const deniedResponse = await fetch(`${baseUrl}/api/admin/discount-approvals`, {
      headers: { cookie: cashierCookie },
    });
    assert.equal(deniedResponse.status, 403);

    const reviewResponse = await fetch(`${baseUrl}/api/admin/discount-approvals/${pending.approval.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'APPROVED' }),
    });
    assert.equal(reviewResponse.status, 200);
    const approved = await reviewResponse.json();
    assert.equal(approved.order.subtotal, 100);
    assert.equal(approved.order.discountAmount, 10);
    assert.equal(approved.order.total, 90);
    assert.equal(approved.order.status, 'AWAITING_PIX');

    const rejectedSale = await fetch(`${baseUrl}/api/caixa/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cashierCookie },
      body: JSON.stringify({
        requestId: require('node:crypto').randomUUID(),
        items: [{ productId: 'discount-plant', quantity: 1 }],
        paymentMethod: 'DINHEIRO',
        discountPercent: 12,
      }),
    });
    const rejectedRequest = await rejectedSale.json();
    const missingReason = await fetch(`${baseUrl}/api/admin/discount-approvals/${rejectedRequest.approval.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'REJECTED', rejectionReason: '   ' }),
    });
    assert.equal(missingReason.status, 400);
    const rejection = await fetch(`${baseUrl}/api/admin/discount-approvals/${rejectedRequest.approval.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'REJECTED', rejectionReason: 'Margem insuficiente' }),
    });
    assert.equal(rejection.status, 200);
    const cashierNotifications = await repo.getUserNotifications('usr-caixa1');
    assert.ok(cashierNotifications.some((notification) => notification.type === 'DISCOUNT_APPROVAL_REJECTED' && notification.reason === 'Margem insuficiente'));
  } finally {
    server.close();
  }
});

test('CAIXA CUSTOMERS: busca e cadastro rápido exigem perfil de colaborador', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });
  await repo.saveCustomerProfile('5564999887766', { name: 'Maria Silva' });
  const app = createApp({ messageService: { firestoreRepo: repo } });
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const unauthorized = await fetch(`${baseUrl}/api/caixa/customers?q=Maria`);
    assert.equal(unauthorized.status, 401);
    const loginResponse = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr-caixa1', pin: '0000' }),
    });
    const cookie = loginResponse.headers.get('set-cookie')?.split(';')[0];
    const searchResponse = await fetch(`${baseUrl}/api/caixa/customers?q=Maria`, { headers: { cookie } });
    assert.equal(searchResponse.status, 200);
    const matches = await searchResponse.json();
    assert.equal(matches[0].id, '5564999887766');
    assert.equal(matches[0].name, 'Maria Silva');
    assert.equal(matches[0].phone, '5564999887766');

    const createResponse = await fetch(`${baseUrl}/api/caixa/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ name: 'João Souza', phone: '(64) 99911-2233' }),
    });
    assert.equal(createResponse.status, 201);
    assert.equal((await repo.getCustomerProfile('5564999112233')).name, 'João Souza');
  } finally {
    server.close();
  }
});
