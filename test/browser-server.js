// Ambiente de teste isolado: nunca acessa serviços externos.
process.env.NODE_ENV = "test";
process.env.REQUEST_AUTH_LIMIT = '10000';
process.env.PIX_MODE ||= "SICREDI";
process.env.PIX_KEY ||= "52998224725";
process.env.PIX_TITULAR ||= "Loja de teste";
const { createApp } = require("../src/http/app");
const { FirestoreRepository } = require("../src/database/firestore.repository");
const repo = new FirestoreRepository({ isInMemory: true });
const { StoreRepository } = require('../src/storefront/repository');
const { seedStores } = require('./storefront-fixture');
(async () => {
  const storeRepository = new StoreRepository();
  await seedStores(storeRepository);
  for (const product of [
    { id: "test-avocado", name: "Abacate KG", category: "Hortifrutti", price: 8.99 },
    { id: "test-begonia", name: "Begônia", category: "Plantas / Mudas", price: 25 },
    { id: "test-zamioculca", name: "Zamioculca", category: "Plantas / Mudas", price: 49 },
    { id: "test-plant", name: "Planta Teste", category: "Plantas", price: 25 },
  ]) {
    await repo.saveProduct({ ...product, stockQuantity: 100, status: "ATIVO" });
  }
  repo.inMemoryProducts.set('legacy-negative-stock', { id: 'legacy-negative-stock', name: 'Estoque legado negativo', price: 10, stockQuantity: -25, status: 'INATIVO', unit: 'UN' });
  const app = createApp({
    storeRepository,
    messageService: {
      firestoreRepo: repo,
      catalogRepo: { items: [], refreshCatalog: async () => {} },
    },
  });
  const port = Number(process.env.BROWSER_TEST_PORT) || 8099;
  app.listen(port, "127.0.0.1", () => console.log('Browser test server: ' + port));
})();
