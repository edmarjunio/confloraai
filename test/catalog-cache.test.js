process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CatalogRepository } = require('./helpers/catalog-fixture');
const { StoreAssistant } = require('../src/storefront/assistant');

test('cache vazio compartilha leitura concorrente, expira e permite invalidar após edição', async () => {
  let now = 1; let reads = 0;
  const catalog = new CatalogRepository({ now: () => now, firestoreRepo: { getAllProducts: async () => { reads++; return []; } } });
  await Promise.all(Array.from({ length: 20 }, () => catalog.refreshCatalog()));
  assert.equal(reads, 1);
  await catalog.refreshCatalog(); assert.equal(reads, 2);
  now += 600000; await catalog.refreshCatalog(); assert.equal(reads, 3);
  catalog.invalidateCache(); await catalog.refreshCatalog(); assert.equal(reads, 4);
});

test('edição durante leitura impede publicação de catálogo antigo; falha pode ser repetida', async () => {
  let release; let reads = 0;
  const catalog = new CatalogRepository({ firestoreRepo: { getAllProducts: async () => {
    reads++;
    if (reads === 1) return new Promise(resolve => { release = resolve; });
    return [{ id: 'new', name: 'Novo', price: 10 }];
  } } });
  const loading = catalog.refreshCatalog(); catalog.invalidateCache(); release([{ id: 'old', name: 'Antigo' }]);
  await loading; assert.equal(catalog.rawItems[0].id, 'new'); assert.equal(reads, 2);
  catalog.invalidateCache(); catalog.firestoreRepo.getAllProducts = async () => { throw new Error('offline'); };
  await assert.rejects(catalog.refreshCatalog(), /offline/); assert.equal(catalog.isCacheValid(), false);
  catalog.firestoreRepo.getAllProducts = async () => [];
  await catalog.refreshCatalog(); assert.equal(catalog.isCacheValid(), false);
});

test('chat sem pesquisa faz uma chamada limitada e não inclui produtos irrelevantes ou instruções na resposta', async () => {
  const calls = [];
  const ai = new StoreAssistant({ client: { models: { generateContent: async request => { calls.push(request); return { text: JSON.stringify({ message: 'Confira o manjericão.', productIds: ['herb', 'unrelated'] }) }; } } } });
  const products = ['Manjericão', 'Automóvel'].map((name, i) => ({ id: i ? 'unrelated' : 'herb', name, isAvailable: true, saleUnit: { minimum: 1 }, stock: { tracked: true, quantity: 5 }, description: '', tags: [] }));
  const result = await ai.recommend({ identity: { name: 'Conflora' } }, {}, products, { message: 'Manjericão', history: Array.from({ length: 20 }, () => ({ role: 'user', text: 'a'.repeat(1000) })) });
  assert.equal(calls.length, 1); assert.equal(calls[0].config.maxOutputTokens, 400);
  assert.equal(calls[0].config.temperature, 0.3); assert.equal(calls[0].contents.length, 7);
  assert.equal(calls[0].contents[0].parts[0].text.length, 600);
  assert.ok(!JSON.stringify(calls).includes('Automóvel')); assert.deepEqual(result.products.map(p => p.id), ['herb']);
  assert.ok(!JSON.stringify(result).includes('systemInstruction'));
});

test('API pública retorna somente reply, usa cache e limita tentativas', async t => {
  const { createApp } = require('../src/http/app');
  const { FirestoreRepository } = require('./helpers/repository-fixture');
  const previousMode = process.env.STOREFRONT_CHAT_MODE;
  process.env.STOREFRONT_CHAT_MODE = 'AI';
  t.after(() => { if (previousMode === undefined) delete process.env.STOREFRONT_CHAT_MODE; else process.env.STOREFRONT_CHAT_MODE = previousMode; });
  const repository = new FirestoreRepository({ isInMemory: true }); repository.storefrontSettings.config.assistant.mode = 'AI'; let reads = 0;
  const catalog = new CatalogRepository({ firestoreRepo: { getAllProducts: async () => { reads++; return []; } } });
  const app = createApp({ messageService: { firestoreRepo: repository, catalogRepo: catalog }, storeAssistant: { recommend: async () => ({ message: 'Olá!', products: [], privateContext: 'never-return' }) } });
  const server = app.listen(0); await new Promise(resolve => server.once('listening', resolve)); t.after(() => server.close());
  const url = 'http://127.0.0.1:' + server.address().port + '/api/chat';
  const send = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Olá', history: [] }) });
  for (let i = 0; i < 8; i++) {
    const response = await send(); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { reply: 'Olá!' });
  }
  assert.equal(reads, 8); assert.equal((await send()).status, 429);
});
