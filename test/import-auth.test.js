process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { FirestoreRepository } = require("../src/database/firestore.repository");
const { readProductWorkbook } = require("../src/catalog/spreadsheet-import");
const { CatalogRepository } = require("../src/catalog/catalog.repository");
const { createApp } = require("../src/http/app");
const fixture = fs.readFileSync(__dirname + "/fixtures/lista-de-produtos.xlsx");
const row = {
  "Product ID": "new",
  DESCRIÇÃO: "Produto novo",
  CATEGORIA: "Horta",
  VALOR: "R$ 1.234,56",
  STATUS: "ATIVO",
};

test("Excel original: 745 IDs únicos, 742 ativos, preços mistos e aba extra ignorada", async () => {
  const audit = await readProductWorkbook(fixture);
  assert.deepEqual(audit.errors, []);
  assert.equal(audit.products.length, 745);
  assert.equal(new Set(audit.products.map((p) => p.id)).size, 745);
  assert.equal(audit.products.filter((p) => p.status === "ATIVO").length, 742);
  assert.deepEqual(audit.ignoredSheets, ["Página4"]);
  assert.equal(audit.products.find((p) => p.id === "311428b7").price, 8.99);
  assert.equal(audit.products.find((p) => p.id === "508ebad7").price, 149);
});

test("Substituição exata, reenvio idempotente e validação antes de qualquer exclusão", async () => {
  const repo = new FirestoreRepository({ isInMemory: true });
  await repo.saveProduct({ id: "old", name: "Antigo", price: 1 });
  const invalid = await repo.replaceProducts([{ ...row, VALOR: "inválido" }]);
  assert.equal(invalid.success, false);
  assert.equal((await repo.getAllProducts())[0].id, "old");
  const { records } = await readProductWorkbook(fixture);
  assert.equal((await repo.replaceProducts(records)).removed, 1);
  assert.equal((await repo.getAllProducts()).length, 745);
  assert.equal((await repo.replaceProducts(records)).removed, 0);
  assert.equal((await repo.getAllProducts()).length, 745);
  const catalog = new CatalogRepository({ firestoreRepo: repo });
  await repo.replaceProducts([row]);
  await catalog.refreshCatalog();
  assert.equal(
    catalog.items.length,
    1,
    "Não mistura os produtos substituídos com catálogo padrão",
  );
  assert.equal(catalog.items[0].price, 1234.56);
});

test("Falha no segundo lote é explícita e não inicia a exclusão de produtos anteriores", async () => {
  let commits = 0;
  let deletes = 0;
  const repo = new FirestoreRepository({
    isInMemory: true,
    firestoreInstance: {
      collection: () => ({
        doc: (id) => ({ id }),
        get: async () => ({
          docs: [{ id: "old", data: () => ({ name: "Antigo" }) }],
        }),
      }),
      batch: () => ({
        set() {},
        delete() {
          deletes++;
        },
        async commit() {
          if (++commits === 2) {
            throw new Error("offline");
          }
        },
      }),
    },
  });
  const { records } = await readProductWorkbook(fixture);
  const result = await repo.replaceProducts(records);
  assert.equal(result.success, false);
  assert.equal(result.partial, true);
  assert.equal(result.count, 200);
  assert.equal(deletes, 0);
});

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
  assert.equal((await request("/api/admin/products", row, cookie)).status, 403);
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
    "/import-data",
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

test("Upload HTTP: prévia, confirmação obrigatória, substituição e rejeição de arquivo inválido", async (t) => {
  const { repo, base, login } = await appContext(t);
  const cookie = await login("usr-edmar", "1234");
  const upload = (query, confirmation, body = fixture) =>
    fetch(base + "/api/admin/import-xlsx?" + query, {
      method: "POST",
      headers: {
        cookie,
        "Content-Type": "application/octet-stream",
        "X-Confirm-Replace": confirmation,
      },
      body,
    });
  const preview = await upload("commit=false&mode=replace", "");
  assert.equal(preview.status, 200);
  assert.equal((await preview.json()).count, 745);
  assert.equal((await repo.getAllProducts()).length, 0);
  assert.equal((await upload("commit=true&mode=replace", "")).status, 400);
  assert.equal(
    (await upload("commit=true&mode=replace", "SUBSTITUIR")).status,
    200,
  );
  assert.equal((await repo.getAllProducts()).length, 745);
  assert.equal(
    (await upload("commit=true&mode=replace", "SUBSTITUIR", Buffer.from("bad")))
      .status,
    400,
  );
  assert.equal((await repo.getAllProducts()).length, 745);
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

test("Mesclar mantém produtos/fotos/estoque, enquanto substituir os remove", async () => {
  const repo = new FirestoreRepository({ isInMemory: true });
  await repo.saveProduct({ id: "old", name: "Antigo" });
  await repo.saveProduct({
    id: "new",
    name: "Novo",
    images: ["https://example.com/photo.jpg"],
    stockQuantity: 25,
  });
  assert.equal(
    (await repo.importSpreadsheetData({ records: [row] })).success,
    true,
  );
  assert.equal((await repo.getAllProducts()).length, 2);
  assert.equal(repo.inMemoryProducts.get("new").stockQuantity, 25);
  assert.equal(repo.inMemoryProducts.get("new").images.length, 1);
  await repo.replaceProducts([row]);
  assert.equal((await repo.getAllProducts()).length, 1);
  assert.equal(repo.inMemoryProducts.get("new").stockQuantity, 0);
  assert.equal(repo.inMemoryProducts.get("new").images?.length || 0, 0);
});
