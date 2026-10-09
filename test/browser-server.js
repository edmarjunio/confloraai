// Ambiente de teste isolado: nunca acessa Firestore, Google ou WhatsApp reais.
process.env.NODE_ENV = "test";
const { createApp } = require("../src/http/app");
const { FirestoreRepository } = require("../src/database/firestore.repository");
const repo = new FirestoreRepository({ isInMemory: true });
(async () => {
  const { readProductWorkbook } = require("../src/catalog/spreadsheet-import");
  const fs = require("node:fs");
  await repo.replaceProducts(
    (
      await readProductWorkbook(
        fs.readFileSync(__dirname + "/fixtures/lista-de-produtos.xlsx"),
      )
    ).records,
  );
  await repo.saveProduct({
    id: "test-plant",
    name: "Planta Teste",
    category: "Plantas",
    price: 25,
    stockQuantity: 100,
    status: "ATIVO",
  });
  const app = createApp({
    messageService: {
      firestoreRepo: repo,
      catalogRepo: { items: [], refreshCatalog: async () => {} },
    },
  });
  app.listen(8099, "127.0.0.1", () => console.log("Browser test server: 8099"));
})();
