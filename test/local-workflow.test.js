const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const ExcelJS = require("exceljs");
const { LocalDatabase } = require("../src/testing/local-database");
const { FirestoreRepository } = require("../src/database/firestore.repository");
const {
  previewProducts,
  replaceProducts,
} = require("../src/import/product-catalog");
const { Ledger } = require("../src/operations/ledger");
const { prepare } = require("../src/operations/importer");
const { createApp } = require("../src/http/app");
const {
  validateLocales,
  t,
  tHtml,
  tTemplate,
  context,
} = require("../src/i18n");
const actor = { id: "admin", name: "Test", role: "ADMIN" };
async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "conflora-"));
  const db = new LocalDatabase(directory);
  const repo = new FirestoreRepository({
    firestoreInstance: db,
    isInMemory: true,
  });
  repo.isLocalTest = true;
  return { directory, db, repo };
}
async function productFile() {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("PRODUTOS");
  sheet.addRow([
    "Product ID",
    "DESCRIÇÃO",
    "STATUS",
    "VALOR",
    "CATEGORIA",
    "SUBCATEGORIA",
  ]);
  sheet.addRow(["p1", "Planta", "ATIVO", 45, "HORTA", "FOLHAS"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
test("catalog replacement keeps stock and backup; ledger uses active catalogue and survives restart", async () => {
  const { directory, db, repo } = await fixture();
  try {
    await repo.saveProduct({
      id: "p1",
      name: "Old",
      price: 40,
      stockQuantity: 10,
      stockVersion: 2,
    });
    const buffer = await productFile();
    const preview = await previewProducts(db, buffer);
    assert.deepEqual(preview.errors, []);
    const replaced = await replaceProducts(
      repo,
      buffer,
      preview.expectedRevision,
      actor,
    );
    assert.equal(replaced.count, 1);
    assert.equal(
      (await db.collection("products").doc("p1").get()).data().name,
      "Old",
    );
    const ledger = new Ledger(repo);
    await ledger.sale(
      {
        requestId: "local-sale-001",
        items: [{ productId: "p1", quantity: 2 }],
        paymentMethod: "DINHEIRO",
      },
      actor,
    );
    const products = await repo.getAllProducts();
    assert.equal(products[0].stockQuantity, 8);
    assert.equal(products[0].price, 45);
    await assert.rejects(() =>
      replaceProducts(repo, buffer, preview.expectedRevision, actor),
    );
    const reopened = new LocalDatabase(directory);
    const state = (
      await reopened.collection("catalog_settings").doc("current").get()
    ).data();
    assert.equal(
      (await reopened.collection(state.collectionPath).doc("p1").get()).data()
        .stockQuantity,
      8,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
test("history sales mode does not require or read ITENS", async () => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("VENDAS HORTA");
  sheet.addRow([
    "Data",
    "CATEGORIA",
    "Valor",
    "Tipo de pagamento",
    "Nome / Razão social",
  ]);
  sheet.addRow(["08/10/2026", "Venda", 100, "DINHEIRO", "Cliente"]);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const preview = await prepare(buffer, [], {}, "sales");
  assert.equal(preview.errors.length, 0);
  assert.equal(
    preview.records.filter((r) => r.collection === "stock_movements").length,
    0,
  );
});
test("local HTTP authentication, translations, pages and generated scripts are functional", async () => {
  const { directory, repo } = await fixture();
  await repo.saveUser({
    id: "test-admin",
    name: "Admin",
    pin: "1234",
    role: "ADMIN",
    active: true,
  });
  const catalogRepo = { items: [], refreshCatalog: async () => {} };
  const app = createApp({
    messageService: { firestoreRepo: repo, catalogRepo },
    taskQueueClient: {},
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = "http://127.0.0.1:" + server.address().port;
  try {
    const login = await fetch(url + "/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "test-admin", pin: "1234" }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await fetch(url + "/api/operations/state", { headers: { cookie } }))
        .status,
      200,
    );
    for (const page of ["/", "/admin", "/lancamentos", "/fiados", "/caixa"]) {
      const response = await fetch(url + page);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /i18n\/bootstrap.js/);
      for (const m of html.matchAll(
        /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g,
      )) {
        if (m[2].trim()) {
          require("espree").parse(m[2], {
            ecmaVersion: 2023,
            sourceType: m[1]?.includes("module") ? "module" : "script",
          });
        }
      }
    }
    const bootstrap = await (
      await fetch(url + "/i18n/bootstrap.js?lang=pt-BR")
    ).text();
    new Function(bootstrap);
    assert.deepEqual(validateLocales(), []);
    assert.equal(
      context.run({ locale: "pt-BR" }, () => t("sales.confirm")),
      "Confirmar venda",
    );
    assert.ok(tHtml("credit.title"));
    assert.ok(tTemplate("credit.title"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("adding a complete locale file changes server and browser messages without code changes", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "conflora-locales-"),
  );
  try {
    const base = require("../src/i18n/locales/pt-BR.json");
    await fs.writeFile(
      path.join(directory, "pt-BR.json"),
      JSON.stringify(base),
    );
    const translated = { ...base, "sales.confirm": "Confirmer la vente" };
    await fs.writeFile(
      path.join(directory, "fr-FR.json"),
      JSON.stringify(translated),
    );
    const { execFileSync } = require("node:child_process");
    const output = execFileSync(
      process.execPath,
      [
        "-e",
        "const i=require('./src/i18n');if(i.validateLocales().length)process.exit(1);console.log(i.context.run({locale:'fr-FR'},()=>i.t('sales.confirm')));console.log(i.supportedLocales().join(','));",
      ],
      {
        cwd: path.join(__dirname, ".."),
        encoding: "utf8",
        env: { ...process.env, I18N_LOCALES_DIR: directory },
      },
    );
    assert.match(output, /Confirmer la vente/);
    assert.match(output, /fr-FR/);
    delete translated["sales.confirm"];
    await fs.writeFile(
      path.join(directory, "fr-FR.json"),
      JSON.stringify(translated),
    );
    const missing = execFileSync(
      process.execPath,
      ["-e", "console.log(require('./src/i18n').validateLocales().join('|'));"],
      {
        cwd: path.join(__dirname, ".."),
        encoding: "utf8",
        env: { ...process.env, I18N_LOCALES_DIR: directory },
      },
    );
    assert.match(missing, /missing sales.confirm/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
