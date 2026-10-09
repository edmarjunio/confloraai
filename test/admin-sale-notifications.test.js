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
        paymentMethod: 'PIX',
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

test('ADMIN NOTIFICATIONS: OrderService.confirmOrder dispara notificação para todos os administradores', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });
  const { OrderService } = require('../src/orders/order.service');
  const catalogRepo = { items: [] };
  const orderService = new OrderService({ firestoreRepo: repo, catalogRepo });

  const pendingOrder = await orderService.createPendingOrder('5564999112233', [
    { product: { canonicalName: 'Ipê Amarelo', prices: [45.0] }, quantity: 2 },
  ], {
    deliveryAddress: 'Rua das Flores, 123',
    paymentMethod: 'PIX',
  });
  assert.ok(pendingOrder);

  const confirmResult = await orderService.confirmOrder('5564999112233', 'Dona Florinda');
  assert.ok(confirmResult);

  const edmarNotifs = await repo.getUserNotifications('usr-edmar');
  const whatsappSaleNotif = edmarNotifs.find(n => n.type === 'SALE_COMPLETED' && n.source === 'WHATSAPP_BOT');
  assert.ok(whatsappSaleNotif, 'Admin deve receber notificação de pedido confirmado no WhatsApp');
  assert.equal(whatsappSaleNotif.customerName, 'Dona Florinda');
  assert.equal(whatsappSaleNotif.orderTotal, 90);
});
