const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Ledger } = require("../src/operations/ledger");
const { prepare, commit } = require("../src/operations/importer");
const { renderOperations } = require("../src/operations/view");
function database() {
  const data = new Map();
  const ref = (path) => ({
    path,
    id: path.split("/").at(-1),
    collection: (n) => collection(path + "/" + n),
    set: async (v) => data.set(path, v),
  });
  const collection = (path) => ({
    doc: (id) => ref(path + "/" + id),
    where: (field, op, value) => ({ query: true, path, field, value }),
  });
  return {
    data,
    collection,
    async runTransaction(fn) {
      const writes = [];
      let wrote = false;
      const get = async (r) => {
        assert.equal(wrote, false, "all reads must precede writes");
        if (r.query) {
          return {
            docs: [...data.entries()]
              .filter(
                ([path, v]) =>
                  path.startsWith(r.path + "/") && v[r.field] === r.value,
              )
              .map(([path]) => ({
                id: path.split("/").at(-1),
                data: () => JSON.parse(JSON.stringify(data.get(path))),
              })),
          };
        }
        return {
          exists: data.has(r.path),
          data: () => JSON.parse(JSON.stringify(data.get(r.path) ?? null)),
          id: r.id,
        };
      };
      const tx = {
        get,
        getAll: (...rs) => Promise.all(rs.map(get)),
        create(r, v) {
          wrote = true;
          writes.push(() => {
            assert.ok(!data.has(r.path));
            data.set(r.path, v);
          });
        },
        set(r, v) {
          wrote = true;
          writes.push(() => data.set(r.path, v));
        },
        update(r, v) {
          wrote = true;
          writes.push(() => data.set(r.path, { ...data.get(r.path), ...v }));
        },
      };
      const result = await fn(tx);
      writes.forEach((w) => w());
      return result;
    },
  };
}
const actor = { id: "operator", name: "Rose", role: "CAIXA" };
function setup(stock = 0) {
  const db = database();
  db.data.set("products/p1", {
    name: "Planta",
    price: 45,
    stockQuantity: stock,
  });
  db.data.set("products/p2", { name: "Alface", price: 5, stockQuantity: 10 });
  return { db, ledger: new Ledger({ firestore: db }) };
}
test("sale preserves item price, negative balance, idempotency and admin discount alert", async () => {
  const { db, ledger } = setup();
  const input = {
    requestId: "sale-00001",
    items: [
      { productId: "p1", quantity: 1 },
      { productId: "p1", quantity: 1 },
    ],
    discount: 5,
    confirmNegative: true,
  };
  const sale = await ledger.sale(input, actor);
  assert.equal(sale.total, 85);
  assert.equal(sale.items[0].price, 45);
  assert.equal(sale.items[0].quantity, 2);
  assert.equal(db.data.get("products/p1").stockQuantity, -2);
  assert.deepEqual(await ledger.sale(input, actor), sale);
  assert.equal(db.data.get("products/p1").stockQuantity, -2);
  assert.equal(
    [...db.data.values()].filter((v) => v.type === "DISCOUNT").length,
    1,
  );
});
test("discount boundaries and insufficient stock do not write", async () => {
  const { db, ledger } = setup();
  const input = {
    requestId: "sale-00002",
    items: [{ productId: "p1", quantity: 2 }],
    discount: 18.01,
    confirmNegative: true,
  };
  await assert.rejects(ledger.sale(input, actor), /20%/);
  assert.equal(db.data.size, 2);
  await assert.rejects(
    ledger.sale({ ...input, discount: 18, confirmNegative: false }, actor),
    /Confirme/,
  );
  await ledger.sale({ ...input, discount: 18 }, actor);
});
test("physical count sets -4 to 20 with +24; stale counts and cashier counts rejected", async () => {
  const { db, ledger } = setup(-4);
  const input = {
    requestId: "count-0001",
    type: "COUNT",
    productId: "p1",
    quantity: 20,
    reason: "Contagem física",
    expectedVersion: 0,
  };
  await assert.rejects(ledger.stock(input, actor), /ADMIN/);
  const admin = { ...actor, role: "ADMIN" };
  const result = await ledger.stock(input, admin);
  assert.equal(result.delta, 24);
  assert.equal(result.newStock, 20);
  await assert.rejects(
    ledger.stock({ ...input, requestId: "count-0002" }, admin),
    /mudou/,
  );
  assert.equal(db.data.get("products/p1").stockQuantity, 20);
});
test("entry adds to negative balance; payment does not deduct stock; cancellation restores once", async () => {
  const { db, ledger } = setup(-4);
  await ledger.stock(
    {
      requestId: "entry-0001",
      type: "ENTRY",
      productId: "p1",
      quantity: 20,
      reason: "Compra",
    },
    actor,
  );
  assert.equal(db.data.get("products/p1").stockQuantity, 16);
  const sale = await ledger.sale(
    {
      requestId: "sale-00003",
      items: [
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 1 },
      ],
      onAccount: true,
    },
    actor,
  );
  await ledger.receive(
    { requestId: "receipt-001", orderId: sale.id, amount: 95 },
    actor,
  );
  assert.equal(db.data.get("products/p1").stockQuantity, 14);
  const input = { requestId: "cancel-001", orderId: sale.id, reason: "Erro" };
  await ledger.cancel(input, { ...actor, role: "ADMIN" });
  await ledger.cancel(
    { ...input, requestId: "cancel-002" },
    { ...actor, role: "ADMIN" },
  );
  assert.equal(db.data.get("products/p1").stockQuantity, 16);
});
test("generated browser script parses", () => {
  const html = renderOperations();
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  assert.doesNotThrow(() => new Function(script));
});
test("import ignores scratch and outgoing items, separates cash and repeated IDs", async () => {
  const ExcelJS = require("exceljs");
  const book = new ExcelJS.Workbook();
  const sales = book.addWorksheet("VENDAS HORTA");
  sales.addRow(["Sale ID", "CATEGORIA", "Valor", "Data", "Status"]);
  sales.addRow(["same", "Venda", 85, "2026-10-08", "RECEBIDO"]);
  sales.addRow(["same", "Recebimento", 20, "2026-10-08", "RECEBIDO"]);
  sales.addRow(["cash", "TROCO DO DIA", 350, "2026-10-08", "TROCO DO DIA"]);
  const items = book.addWorksheet("ITENS");
  items.addRow([
    "Item ID",
    "Tipo de movimentação",
    "Descrição",
    "Quantidade",
    "Produto Selecionado",
  ]);
  items.addRow(["repeat", "ENTRADA", "Planta", 20, "p1"]);
  items.addRow(["repeat", "ENTRADA", "Planta", 2, "p1"]);
  items.addRow(["out", "SAÍDA", "Planta", 100, "p1"]);
  book.addWorksheet("Página3").addRow(["ignored"]);
  const buffer = Buffer.from(await book.xlsx.writeBuffer());
  const audit = await prepare(buffer, [{ id: "p1", name: "Planta" }]);
  assert.equal(audit.errors.length, 0);
  assert.deepEqual(audit.counts, {
    orders: 1,
    historical_receipts: 1,
    cash_movements: 1,
    initial_entries: 2,
  });
  assert.equal(new Set(audit.records.map((r) => r.id)).size, 5);
  assert.equal(audit.records[0].data.stockDeducted, false);
  assert.equal(audit.warnings.length, 1);
});

test("initial stock import resumes and repeated execution does not duplicate stock", async () => {
  const { db } = setup(-4);
  const preview = {
    importId: "batch",
    errors: [],
    warnings: [],
    counts: { initial_entries: 1 },
    records: [
      {
        id: "row1",
        collection: "initial_entries",
        data: { productId: "p1", quantity: 20 },
      },
    ],
  };
  const first = await commit(db, preview, { ...actor, role: "ADMIN" });
  assert.equal(first.complete, true);
  assert.equal(first.nextOffset, 1);
  assert.equal(first.imported, 1);
  assert.equal(db.data.get("products/p1").stockQuantity, 16);
  const replay = await commit(db, preview, { ...actor, role: "ADMIN" });
  assert.equal(replay.imported, 0);
  assert.equal(db.data.get("products/p1").stockQuantity, 16);
});

test("fiado 900, receipt 400, remaining 500; overpayment, zero debt and replay blocked safely", async () => {
  const { db, ledger } = setup(100);
  const customer = await ledger.createCreditCustomer(
    { requestId: "customer-001", name: "Edmar Júnio" },
    actor,
  );
  const sale = await ledger.sale(
    {
      requestId: "credit-sale1",
      items: [{ productId: "p1", quantity: 20 }],
      paymentMethod: "A RECEBER",
      creditCustomerId: customer.id,
    },
    actor,
  );
  assert.equal(
    db.data.get("credit_customers/" + customer.id).balanceCents,
    90000,
  );
  const payment = {
    requestId: "credit-pay1",
    customerId: customer.id,
    amount: 400,
  };
  const receipt = await ledger.receiveCredit(payment, actor);
  assert.equal(receipt.balance, 500);
  assert.equal(db.data.get("orders/" + sale.id).paidAmount, 400);
  await ledger.receiveCredit(payment, actor);
  assert.equal(
    db.data.get("credit_customers/" + customer.id).balanceCents,
    50000,
  );
  await assert.rejects(
    ledger.receiveCredit(
      { ...payment, requestId: "credit-pay2", amount: 500.01 },
      actor,
    ),
    /maior/,
  );
  await ledger.receiveCredit(
    { ...payment, requestId: "credit-pay3", amount: 500 },
    actor,
  );
  assert.equal(db.data.get("orders/" + sale.id).paymentStatus, "RECEBIDO");
  await assert.rejects(
    ledger.receiveCredit(
      { ...payment, requestId: "credit-pay4", amount: 0.01 },
      actor,
    ),
    /maior/,
  );
  assert.equal(db.data.get("products/p1").stockQuantity, 80);
});
test("credit receipt splits across oldest sales, individual receipt and cancellation update same customer balance", async () => {
  const { db, ledger } = setup(100);
  const customer = await ledger.createCreditCustomer(
    { requestId: "customer-002", name: "Edmar" },
    actor,
  );
  const input = {
    items: [{ productId: "p1", quantity: 10 }],
    paymentMethod: "A RECEBER",
    creditCustomerId: customer.id,
  };
  const first = await ledger.sale(
    { ...input, requestId: "credit-sal2" },
    actor,
  );
  const second = await ledger.sale(
    { ...input, requestId: "credit-sal3" },
    actor,
  );
  const receipt = await ledger.receiveCredit(
    { requestId: "credit-pay5", customerId: customer.id, amount: 500 },
    actor,
  );
  assert.equal(receipt.allocations.length, 2);
  assert.equal(receipt.balance, 400);
  const unpaid = [first, second].find(
    (s) => db.data.get("orders/" + s.id).paymentStatus !== "RECEBIDO",
  );
  await ledger.receive(
    { requestId: "credit-pay6", orderId: unpaid.id, amount: 100 },
    actor,
  );
  assert.equal(
    db.data.get("credit_customers/" + customer.id).balanceCents,
    30000,
  );
  await ledger.cancel(
    { requestId: "credit-can1", orderId: unpaid.id, reason: "Correção" },
    { ...actor, role: "ADMIN" },
  );
  assert.equal(db.data.get("credit_customers/" + customer.id).balanceCents, 0);
  assert.equal(db.data.get("orders/" + unpaid.id).refundRequired, true);
});
test("credit sale requires named registered customer; optional entry cost yields immutable 80 percent gross margin", async () => {
  const { db, ledger } = setup(10);
  await assert.rejects(
    ledger.sale(
      {
        requestId: "credit-bad1",
        items: [{ productId: "p1", quantity: 1 }],
        paymentMethod: "A RECEBER",
      },
      actor,
    ),
    /cliente cadastrado/,
  );
  db.data.set("products/p1", { name: "Planta", price: 50, stockQuantity: 0 });
  await ledger.stock(
    {
      requestId: "cost-entry1",
      type: "ENTRY",
      productId: "p1",
      quantity: 10,
      unitCost: 10,
      reason: "Compra",
    },
    actor,
  );
  const sale = await ledger.sale(
    { requestId: "cost-sale01", items: [{ productId: "p1", quantity: 1 }] },
    actor,
  );
  assert.equal(sale.items[0].price, 50);
  assert.equal(sale.items[0].estimatedProfit, 40);
  assert.equal(sale.items[0].profitPercent, 80);
  assert.equal(sale.items[0].markupPercent, 400);
  await ledger.stock(
    {
      requestId: "cost-entry2",
      type: "ENTRY",
      productId: "p1",
      quantity: 1,
      unitCost: 20,
      reason: "Compra",
    },
    actor,
  );
  assert.equal(db.data.get("orders/" + sale.id).items[0].unitCost, 10);
  const noCost = await ledger.sale(
    { requestId: "cost-sale02", items: [{ productId: "p2", quantity: 1 }] },
    actor,
  );
  assert.equal(noCost.items[0].estimatedProfit, null);
});

test("opening is unique per business day and all cash movements are idempotent", async () => {
  const { db, ledger } = setup();
  const opening = {
    requestId: "opening-001",
    type: "OPENING",
    amount: 352.2,
    reason: "Troco inicial",
  };
  await ledger.cash(opening, actor);
  await ledger.cash(opening, actor);
  await assert.rejects(
    ledger.cash({ ...opening, requestId: "opening-002" }, actor),
    /já foi registrado/,
  );
  await ledger.cash(
    {
      requestId: "withdraw-001",
      type: "WITHDRAWAL",
      amount: 50,
      reason: "Retirada",
    },
    actor,
  );
  assert.equal(
    [...db.data.keys()].filter((p) => p.startsWith("cash_movements/")).length,
    2,
  );
});
test("cost-free initial entry may have no Sale ID and no price; informed entry cost is preserved", async () => {
  const ExcelJS = require("exceljs");
  const book = new ExcelJS.Workbook();
  const sales = book.addWorksheet("VENDAS HORTA");
  sales.addRow(["Sale ID", "CATEGORIA", "Valor", "Data"]);
  sales.addRow(["v1", "Venda", 5, "2026-10-08"]);
  const items = book.addWorksheet("ITENS");
  items.addRow([
    "Item ID",
    "Sale ID",
    "Tipo de movimentação",
    "Descrição",
    "Quantidade",
    "Valor unitário",
    "Produto Selecionado",
  ]);
  items.addRow(["e1", null, "ENTRADA", "Planta", 2, null, "p1"]);
  items.addRow(["e2", null, "ENTRADA", "Planta", 3, 10, "p1"]);
  const audit = await prepare(Buffer.from(await book.xlsx.writeBuffer()), [
    { id: "p1", name: "Planta" },
  ]);
  assert.equal(audit.errors.length, 0);
  const entries = audit.records.filter(
    (r) => r.collection === "initial_entries",
  );
  assert.equal(entries[0].data.unitCost, null);
  assert.equal(entries[1].data.unitCost, 10);
});

test("Google-only administrator cannot bypass operator authentication with an arbitrary PIN", async () => {
  const {
    FirestoreRepository,
  } = require("../src/database/firestore.repository");
  const repo = new FirestoreRepository({ isInMemory: true });
  await repo.saveUser({
    id: "google-only",
    email: "admin@example.com",
    name: "Admin",
    role: "ADMIN",
    active: true,
  });
  assert.equal(
    (await repo.authenticateUser("google-only", "anything")).success,
    false,
  );
});
