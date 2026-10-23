process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const { FirestoreRepository } = require("./helpers/repository-fixture");
const { createApp } = require("../src/http/app");
async function appContext(t) {
  const repo = new FirestoreRepository({ isInMemory: true });
  const app = createApp({
    messageService: { firestoreRepo: repo },
    verifyGoogleToken: async (token) => {
      if (token === "invalid") {
        throw new Error("invalid");
      }
      return {
        uid: token,
        email: token,
        email_verified: true,
        firebase: { sign_in_provider: "google.com" },
      };
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());
  const base = "http://localhost:" + server.address().port;
  const request = (
    path,
    data,
    cookie = "",
    method = data === undefined ? "GET" : "POST",
  ) =>
    fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", cookie },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  const login = async (userId, pin) => {
    const response = await request("/api/admin/auth/login", { userId, pin });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  };
  return { repo, base, request, login };
}

test('minha conta exige login e reúne vendas do cadastro financeiro sem expor outro cliente', async (t) => {
  const { repo, request } = await appContext(t);
  assert.equal((await request('/api/customer/ledger')).status, 401);
  assert.equal((await request('/api/customer/orders')).status, 401);
  await request('/api/auth/register', { email: 'conta@test.com', name: 'Cliente Conta', password: 'senha123' });
  const login = await request('/api/auth/login', { email: 'conta@test.com', password: 'senha123' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  await repo.saveCustomerProfile('5564999991122', { name: 'Cliente Conta', email: 'conta@test.com', debtBalance: 75, creditBalance: 10 });
  await repo.createDirectOrder({ id: 'pdv-linked', customerId: '5564999991122', customerName: 'Cliente Conta', paymentMethod: 'FIADO', paymentStatus: 'ON_ACCOUNT', total: 100, items: [] });
  await repo.createDirectOrder({ id: 'private-other', customerId: 'other-customer', customerEmail: 'other@test.com', total: 999, items: [] });
  repo.inMemoryCustomerDebts = [{ id: 'debt-1', customerKey: '5564999991122', orderId: 'pdv-linked', type: 'DEBITO_FIADO', amount: 100, createdAt: '2026-10-15T12:00:00Z' }];
  repo.inMemoryDebtSettlements = [
    { id: 'payment-1', customerKey: '5564999991122', type: 'QUITACAO_FIADO', amount: 25, paymentMethod: 'DINHEIRO', receivedBy: { name: 'Caixa' }, newBalance: 75, createdAt: '2026-10-16T12:00:00Z' },
    { id: 'private-debt', customerKey: 'other-customer', type: 'QUITACAO_FIADO', amount: 999 },
  ];
  const history = await (await request('/api/customer/orders?customerId=other-customer', undefined, cookie)).json();
  assert.deepEqual(history.orders.map((order) => order.id), ['pdv-linked']);
  const ledger = await (await request('/api/customer/ledger?customerId=other-customer', undefined, cookie)).json();
  assert.equal(ledger.balance, 75);
  assert.equal(ledger.creditBalance, 10);
  assert.equal(ledger.transactions.length, 2);
  assert.ok(ledger.transactions.some((entry) => entry.type === 'QUITACAO_FIADO' && entry.amount === 25 && entry.receivedBy === 'Caixa'));
  assert.ok(ledger.transactions.some((entry) => entry.type === 'DEBITO_FIADO' && entry.receiptText.includes('Cliente Conta')));
});

test("store branding settings require admin, validate data, persist and reject stale updates", async (t) => {
  const { request, login } = await appContext(t);
  assert.equal((await request('/api/storefront/admin/config')).status,401);
  const admin = await login('usr-edmar','1234');
  const cashier = await login('usr-caixa1','0000');
  assert.equal((await request('/api/storefront/admin/config',undefined,cashier)).status,403);
  const original = await (await request('/api/storefront/admin/config',undefined,admin)).json();
  const config=structuredClone(original.config);
  config.identity.name='Loja de Cosméticos';
  config.identity.city='São Paulo';
  config.branding.colors.primary='#2345ab';
  config.assistant.mode='GUIDED';
  config.assistant.synonyms=[['batom','lipstick']];
  const invalid=structuredClone(config); invalid.branding.logoUrl='javascript:alert(1)';
  assert.equal((await request('/api/storefront/admin/config',{config:invalid},admin,'PUT')).status,400);
  assert.equal((await request('/api/storefront/admin/config',{config},admin,'PUT')).status,200);
  assert.equal((await request('/api/storefront/admin/config',{config},admin,'PUT')).status,409);
  const result=await (await request('/api/storefront/catalog')).json();
  assert.equal(result.config.identity.name,'Loja de Cosméticos');
  assert.equal(result.config.branding.colors.primary,'#2345ab');
  assert.deepEqual(result.config.assistant.synonyms,[['batom','lipstick']]);
  assert.equal((await request('/api/storefront/assistant',{message:'batom'})).status,409);
});

test("inventory settings are admin-only and control stock deduction", async (t) => {
  const { repo, request, login } = await appContext(t);
  const admin = await login("usr-edmar", "1234");
  const cashier = await login("usr-caixa1", "0000");
  assert.equal((await request("/api/admin/inventory-settings")).status, 401);
  assert.equal((await request("/api/admin/inventory-settings", { stockControlEnabled: false }, cashier, "PUT")).status, 403);
  assert.equal((await request("/api/admin/inventory-settings", { stockControlEnabled: "false" }, admin, "PUT")).status, 400);
  await repo.saveProduct({ id: "stock-switch", name: "Stock switch", price: 10, stockQuantity: 5 });
  const update = await request("/api/admin/inventory-settings", { stockControlEnabled: false }, admin, "PUT");
  assert.equal(update.status, 200);
  assert.equal((await (await request("/api/admin/inventory-settings", undefined, admin)).json()).stockControlEnabled, false);
  const deduction = await repo.deductStock([{ productId: "stock-switch", quantity: 2 }]);
  assert.equal(deduction.trackingDisabled, true);
  assert.equal((await repo.getAllProducts()).find(p => p.id === "stock-switch").stockQuantity, 5);
  await repo.saveInventorySettings({ stockControlEnabled: true });
  await repo.deductStock([{ productId: "stock-switch", quantity: 2 }]);
  assert.equal((await repo.getAllProducts()).find(p => p.id === "stock-switch").stockQuantity, 3);
});

test('ajustes do estoque exigem Admin e preservam histórico, motivo e idempotência', async (t) => {
  const { repo, request, login } = await appContext(t);
  const admin = await login('usr-edmar', '1234');
  const cashier = await login('usr-caixa1', '0000');
  await repo.saveProduct({ id: 'stock-audit', name: 'Muda auditada', price: 20, stockQuantity: 10 });

  assert.equal((await request('/api/admin/stock/movements')).status, 401);
  assert.equal((await request('/api/admin/stock/movements', undefined, cashier)).status, 403);
  assert.equal((await request('/api/admin/stock/adjustments', {
    productId: 'stock-audit', operation: 'ENTRY', quantity: 1, requestId: 'cashier-denied-001',
  }, cashier)).status, 403);

  const entryBody = { productId: 'stock-audit', operation: 'ENTRY', quantity: 5, requestId: 'admin-entry-0001' };
  const entry = await (await request('/api/admin/stock/adjustments', entryBody, admin)).json();
  assert.equal(entry.newStock, 15);
  assert.equal((await (await request('/api/admin/stock/adjustments', entryBody, admin)).json()).duplicate, true);
  const missingReason = await request('/api/admin/stock/adjustments', {
    productId: 'stock-audit', operation: 'EXIT', quantity: 1, requestId: 'admin-exit-missing',
  }, admin);
  assert.equal(missingReason.status, 400);
  const exit = await (await request('/api/admin/stock/adjustments', {
    productId: 'stock-audit', operation: 'EXIT', quantity: 2,
    reason: 'Folhas danificadas na contagem', requestId: 'admin-exit-0001',
  }, admin)).json();
  assert.equal(exit.newStock, 13);
  const count = await (await request('/api/admin/stock/adjustments', {
    productId: 'stock-audit', operation: 'SET', quantity: 7,
    reason: 'Contagem física do viveiro', requestId: 'admin-count-0001',
  }, admin)).json();
  assert.equal(count.newStock, 7);
  assert.equal((await repo.getAllProducts()).find((product) => product.id === 'stock-audit').stockQuantity, 7);
  assert.equal((await request('/api/admin/stock/movements?limit=10', undefined, admin)).status, 200);
  assert.ok((await repo.getUserNotifications('usr-edmar')).some((notification) => notification.type === 'STOCK_DECREASED'));
});

test('histórico autenticado entrega o mesmo recibo salvo para envio ao cliente', async (t) => {
  const { repo, request } = await appContext(t);
  const registration = await request('/api/auth/register', {
    email: 'historico@test.com', name: 'Cliente Histórico', password: 'senha123',
  });
  const account = (await registration.json()).user;
  const loginResponse = await request('/api/auth/login', { email: 'historico@test.com', password: 'senha123' });
  const cookie = loginResponse.headers.get('set-cookie').split(';')[0];
  const order = await repo.createDirectOrder({
    id: 'order-history-exact', customerId: account.id, customerEmail: account.email,
    customerName: account.name, customerPhone: '64999990000', orderType: 'DELIVERY',
    deliveryAddress: 'Rua das Flores, 10', paymentMethod: 'PIX', total: 25, subtotal: 25,
    items: [{ productId: 'muda-1', name: 'Muda teste', price: 25, quantity: 1, unit: 'UN' }],
  });
  const { formatOrderReceipt } = require('../src/orders/receipt.util');
  const sentReceiptText = formatOrderReceipt(order);
  await repo.saveOrderReceipt(order.id, sentReceiptText);

  const response = await request('/api/customer/orders?limit=12', undefined, cookie);
  const history = await response.json();
  assert.equal(response.status, 200);
  assert.equal(history.orders[0].receiptText, sentReceiptText);
  assert.equal(history.orders[0].id, order.id);
});

test("Login PIN: inválido, conta sem PIN, inativa, cliente e encerramento de sessão", async (t) => {
  const { repo, request, login } = await appContext(t);
  assert.equal(
    (
      await request("/api/admin/auth/login", {
        userId: "usr-edmar",
        pin: "wrong",
      })
    ).status,
    401,
  );
  await repo.saveUser({ id: "no-pin", role: "ADMIN", email: "nopin@test.com" });
  assert.equal(
    (await request("/api/admin/auth/login", { userId: "no-pin", pin: "1234" }))
      .status,
    401,
  );
  await repo.saveUser({
    id: "off",
    role: "CAIXA",
    email: "off@test.com",
    pin: "1234",
    active: false,
  });
  assert.equal(
    (await request("/api/admin/auth/login", { userId: "off", pin: "1234" }))
      .status,
    401,
  );
  const cookie = await login("usr-edmar", "1234");
  assert.equal(
    (await request("/api/admin/orders", undefined, cookie)).status,
    200,
  );
  await request("/api/auth/logout", {}, cookie);
  assert.equal(
    (await request("/api/admin/orders", undefined, cookie)).status,
    401,
  );
});

test("Cadastro/senha: não toma conta existente; cliente não acessa admin nem dados de outro cliente", async (t) => {
  const { request } = await appContext(t);
  assert.equal(
    (
      await request("/api/auth/register", {
        email: "edmarjuniob@gmail.com",
        password: "hack",
      })
    ).status,
    400,
  );
  const registration = await request("/api/auth/register", {
    email: "client@test.com",
    name: "Cliente",
    password: "senha123",
  });
  assert.equal(registration.status, 200);
  assert.equal((await registration.json()).user.role, "CLIENTE");
  const response = await request("/api/auth/login", {
    email: "client@test.com",
    password: "senha123",
  });
  const cookie = response.headers.get("set-cookie").split(";")[0];
  assert.equal((await request("/api/admin/products", { id: "forbidden", name: "Forbidden", category: "Horta", price: 1 }, cookie)).status, 403);
  assert.equal(
    (await request("/api/customer/orders?userId=usr-edmar", undefined, cookie))
      .status,
    200,
  );
  assert.equal((await request("/api/customer/orders")).status, 401);
  assert.equal(
    (
      await request("/api/auth/login", {
        email: "client@test.com",
        password: "wrong",
      })
    ).status,
    401,
  );
});

test("Permissões: visitante, caixa, admin, revogação e lista pública sem credenciais", async (t) => {
  const { repo, request, login } = await appContext(t);
  const users = await (await request("/api/admin/auth/users")).json();
  assert.ok(
    users.every((u) => !("pin" in u) && !("password" in u) && !("email" in u)),
  );
  assert.equal((await request("/api/admin/orders")).status, 401);
  const cashier = await login("usr-caixa1", "0000");
  for (const route of [
    "/orders",
    "/daily-metrics",
    "/alterations",
    "/notifications",
  ]) {
    assert.equal(
      (await request("/api/admin" + route, undefined, cashier)).status,
      200,
    );
  }
  for (const route of [
    "/products",
    "/seed-catalog",
    "/users",
  ]) {
    assert.equal(
      (await request("/api/admin" + route, {}, cashier)).status,
      403,
    );
  }
  await repo.updateUserRole("usr-caixa1", "CLIENTE");
  assert.equal(
    (await request("/api/admin/orders", undefined, cashier)).status,
    403,
  );
});

test("Google: caixa mantém perfil, inativo bloqueado e token inválido não cria sessão", async (t) => {
  const { repo, request } = await appContext(t);
  const response = await request("/api/auth/google", {
    idToken: "caixa1@conflora.com.br",
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.role, "CAIXA");
  assert.ok(response.headers.get("set-cookie").includes("HttpOnly"));
  assert.equal(
    (await request("/api/auth/google", { idToken: "invalid" })).status,
    401,
  );
  await repo.saveUser({
    id: "inactive-google",
    email: "off@google.com",
    active: false,
    role: "ADMIN",
  });
  assert.equal(
    (await request("/api/auth/google", { idToken: "off@google.com" })).status,
    403,
  );
});

test("Fluxo caixa: venda, solicitação, aprovação/recusa de admin e notificações", async (t) => {
  const { repo, request, login } = await appContext(t);
  const cashier = await login("usr-caixa1", "0000");
  const admin = await login("usr-edmar", "1234");
  assert.equal((await request("/api/caixa/open-my-cashier", { requestId: require("node:crypto").randomUUID(), openingFloat: 0 }, cashier)).status, 200);
  await repo.saveProduct({
    id: "sale",
    name: "Venda teste",
    price: 10,
    stockQuantity: 10,
  });
  const sale = await (
    await request(
      "/api/admin/orders/manual",
      {
        customerName: "Cliente Caixa",
        items: [
          { productId: "sale", name: "Venda teste", price: 10, quantity: 2 },
        ],
        paymentMethod: "DINHEIRO",
      },
      cashier,
    )
  ).json();
  assert.equal(sale.order.total, 20);
  assert.equal((await repo.getAllProducts())[0].stockQuantity, 8);
  for (const action of ["APPROVED", "REJECTED"]) {
    const result = await (
      await request(
        "/api/admin/alterations",
        {
          orderId: sale.order.id,
          originalOrder: sale.order,
          proposedOrder: { ...sale.order, customerName: "Nome corrigido" },
          reason: "Correção de nome",
          requestedBy: "forged",
        },
        cashier,
      )
    ).json();
    assert.equal(result.request.requestedBy, "usr-caixa1");
    const id = result.request.id;
    assert.equal(
      (
        await request(
          "/api/admin/alterations/" + id + "/review",
          { action },
          cashier,
        )
      ).status,
      403,
    );
    const review = await (
      await request(
        "/api/admin/alterations/" + id + "/review",
        { action, rejectionReason: "Conferir dados" },
        admin,
      )
    ).json();
    assert.equal(review.status, action);
  }
  const notifications = await (
    await request("/api/admin/notifications", undefined, cashier)
  ).json();
  assert.equal(notifications.length, 2);
  assert.equal(
    (
      await request(
        "/api/admin/notifications/" + notifications[0].id + "/read",
        {},
        cashier,
      )
    ).status,
    200,
  );
  const metrics = await (
    await request("/api/admin/daily-metrics", undefined, admin)
  ).json();
  assert.equal(metrics.totalRevenue, 20);
});

test('tab credentials isolate accounts, refresh and logout despite a cookie from another login', async (t) => {
  const { base } = await appContext(t);
  const login = async (userId, pin, token = '') => {
    const response = await fetch(base + '/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Conflora-Tab-Session': '1', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ userId, pin }) });
    assert.equal(response.status, 200);
    return { token: response.headers.get('x-conflora-session'), cookie: response.headers.get('set-cookie').split(';')[0] };
  };
  const admin = await login('usr-edmar', '1234'); const cashier = await login('usr-caixa1', '0000', admin.token);
  const headers = { 'X-Conflora-Tab-Session': '1', Authorization: 'Bearer ' + admin.token, cookie: cashier.cookie };
  const me = await (await fetch(base + '/api/auth/me', { headers })).json();
  assert.equal(me.user.id, 'usr-edmar');
  assert.equal((await fetch(base + '/api/auth/me', { headers: { 'X-Conflora-Tab-Session': '1', cookie: admin.cookie } })).status, 401);
  assert.equal((await fetch(base + '/api/admin/users', { headers: { 'X-Conflora-Tab-Session': '1', Authorization: 'Bearer ' + cashier.token, cookie: admin.cookie } })).status, 403);
  await fetch(base + '/api/auth/logout', { method: 'POST', headers: { 'X-Conflora-Tab-Session': '1', Authorization: 'Bearer ' + cashier.token } });
  assert.equal((await fetch(base + '/api/auth/me', { headers })).status, 200);
  assert.equal((await fetch(base + '/api/auth/me', { headers: { 'X-Conflora-Tab-Session': '1', Authorization: 'Bearer ' + cashier.token, cookie: admin.cookie } })).status, 401);
});
