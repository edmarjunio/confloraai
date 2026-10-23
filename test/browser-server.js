// Ambiente de teste isolado: nunca acessa serviços externos.
process.env.NODE_ENV = "test";
process.env.REQUEST_AUTH_LIMIT = '10000';
process.env.PIX_MODE ||= "MANUAL";
process.env.PIX_KEY ||= "52998224725";
process.env.PIX_TITULAR ||= "Loja de teste";
const { createApp } = require("../src/http/app");
const emptyDatabase = process.env.BROWSER_EMPTY_DATABASE === 'true';
const { FirestoreRepository } = require(emptyDatabase ? "../src/database/firestore.repository" : "./helpers/repository-fixture");
const repo = new FirestoreRepository({ isInMemory: true });
const { StoreRepository } = require('../src/storefront/repository');
const { seedStores } = require('./storefront-fixture');
(async () => {
  const storeRepository = new StoreRepository();
  if (!emptyDatabase) await seedStores(storeRepository);
  for (const product of emptyDatabase ? [] : [
    { id: "test-avocado", name: "Abacate KG", category: "Hortifrutti", price: 8.99 },
    { id: "test-begonia", name: "Begônia", category: "Plantas / Mudas", price: 25 },
    { id: "test-zamioculca", name: "Zamioculca", category: "Plantas / Mudas", price: 49 },
    { id: "test-plant", name: "Planta Teste", category: "Plantas", price: 25 },
  ]) {
    await repo.saveProduct({ ...product, stockQuantity: 100, status: "ATIVO" });
  }
  if (!emptyDatabase) repo.inMemoryProducts.set('legacy-negative-stock', { id: 'legacy-negative-stock', name: 'Estoque legado negativo', price: 10, stockQuantity: -25, status: 'INATIVO', unit: 'UN' });
  const app = createApp({
    storeRepository,
    ...(emptyDatabase ? { verifyGoogleToken: async token => {
      if (token !== 'isolated-empty-owner') throw new Error('Invalid test token');
      return { uid: 'isolated-empty-owner', email: 'edmarjuniob@gmail.com', name: 'Administrador', email_verified: true,
        firebase: { sign_in_provider: 'google.com' } };
    } } : {}),
    messageService: {
      firestoreRepo: repo,
      catalogRepo: { items: [], refreshCatalog: async () => {} },
    },
  });
  const port = Number(process.env.BROWSER_TEST_PORT) || 8099;
  app.listen(port, "127.0.0.1", () => console.log('Browser test server: ' + port));
})();
