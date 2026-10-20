process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareImport, ProductImportService, CSV_TEMPLATE } = require('../src/catalog/product-import');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { createApp } = require('../src/http/app');
const sample = 'codigo;nome;preco;categoria;unidade;estoque\r\n001;"Alface; orgânica";4,50;Horta;UN;10\r\n002;Tomate;8.90;Horta;KG;12,345';

test('importação entende CSV brasileiro, aspas, zeros no código e medidas sem executar fórmulas', () => {
  const plan = prepareImport(sample);
  assert.deepEqual(plan.errors, []); assert.equal(plan.total, 2);
  assert.equal(plan.products[0].sku, '001'); assert.equal(plan.products[0].name, 'Alface; orgânica'); assert.equal(plan.products[0].price, 4.5);
  assert.equal(plan.products[1].stockQuantity, 12.345); assert.equal(plan.products[1].saleUnit.code, 'KG');
  assert.ok(CSV_TEMPLATE.startsWith('\uFEFF'));
  for (const csv of [sample.replace('4,50', '1.234,50'), sample.replace(';UN;10', ';UN;1,5'), sample.replace('002;', '001;'), sample.replace('8.90', '=SUM(A1)')]) assert.ok(prepareImport(csv).errors.length);
  assert.throws(() => prepareImport('nome;preco\nAlface;4'), /obrigatória/);
});

test('prévia não grava; confirmação concorrente e reenvio não duplicam nem substituem estoque movimentado', async () => {
  const repository = new FirestoreRepository({ isInMemory: true });
  const service = new ProductImportService(repository);
  const plan = await service.preview(sample); assert.equal(repository.inMemoryProducts.size, 0);
  await Promise.all([service.commit(sample, plan.importId, { id: 'admin' }), service.commit(sample, plan.importId, { id: 'admin' })]);
  assert.equal(repository.inMemoryProducts.size, 2);
  const product = repository.inMemoryProducts.get(plan.products[0].id); product.stockQuantity = 8;
  await service.commit(sample, plan.importId, { id: 'admin' }); assert.equal(repository.inMemoryProducts.get(product.id).stockQuantity, 8);
  assert.ok((await service.preview(sample.replace('4,50', '5,00'))).errors.length);
  await assert.rejects(service.commit(sample, 'arquivo-trocado', { id: 'admin' }), /mudou/);
});

test('importação retoma lotes após falha sem regravar os produtos do primeiro lote', async () => {
  const repository = new FirestoreRepository({ isInMemory: true }); const service = new ProductImportService(repository);
  const csv = 'codigo;nome;preco;categoria;unidade;estoque\n' + Array.from({ length: 405 }, (_, index) => `P${index};Produto ${index};10;Horta;UN;10`).join('\n');
  const plan = await service.preview(csv); const transaction = service.store.transaction.bind(service.store); let count = 0;
  service.store.transaction = work => { if (++count === 2) throw new Error('falha simulada'); return transaction(work); };
  await assert.rejects(service.commit(csv, plan.importId, { id: 'admin' }), /simulada/); assert.equal(repository.inMemoryProducts.size, 200);
  repository.inMemoryProducts.get(plan.products[0].id).stockQuantity = 5;
  service.store.transaction = transaction; await service.commit(csv, plan.importId, { id: 'admin' });
  assert.equal(repository.inMemoryProducts.size, 405); assert.equal(repository.inMemoryProducts.get(plan.products[0].id).stockQuantity, 5);
});

test('rotas de importação exigem Admin e expõem modelo somente autenticado', async t => {
  const repo = new FirestoreRepository({ isInMemory: true }); const app = createApp({ messageService: { firestoreRepo: repo } });
  const server = app.listen(0); await new Promise(resolve => server.once('listening', resolve)); t.after(() => server.close()); const base = 'http://127.0.0.1:' + server.address().port;
  const post = (url, data, cookie = '') => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(data) });
  assert.equal((await post('/api/admin/import-products', { products: [] })).status, 401);
  assert.equal((await post('/api/admin/products/import/commit', { csv: sample })).status, 401);
  const login = await post('/api/admin/auth/login', { userId: 'usr-caixa1', pin: '0000' }); const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await post('/api/admin/products/import/preview', { csv: sample }, cookie)).status, 403);
  const admin = await post('/api/admin/auth/login', { userId: 'usr-edmar', pin: '1234' }); const adminCookie = admin.headers.get('set-cookie').split(';')[0];
  const preview = await (await post('/api/admin/products/import/preview', { csv: sample }, adminCookie)).json();
  assert.equal((await post('/api/admin/products/import/commit', { csv: sample, importId: preview.importId }, adminCookie)).status, 200);
  assert.equal(repo.inMemoryProducts.size, 2);
  const products = [{ sku: 'JSON1', name: 'Produto JSON', price: 10, category: 'Horta', unit: 'UN', stock: 2 }];
  assert.equal((await post('/api/admin/import-products/preview', { products }, cookie)).status, 403);
  const jsonPlan = await (await post('/api/admin/import-products/preview', { products }, adminCookie)).json();
  assert.equal((await post('/api/admin/import-products', { products, importId: jsonPlan.importId }, adminCookie)).status, 200);
  assert.equal(repo.inMemoryProducts.size, 3);
});


test('JSON usa validação e IDs do CSV, rejeita campos inválidos e mantém idempotência', async () => {
  const products = [{ sku: '001', name: 'Alface; orgânica', price: 4.5, category: 'Horta', unit: 'UN', stock: 10 }, { codigo: '002', nome: 'Tomate', preco: 8.9, categoria: 'Horta', unidade: 'KG', estoque: 12.345 }];
  const plan = prepareImport(products); assert.deepEqual(plan.errors, []);
  assert.equal(plan.importId, prepareImport(sample).importId);
  assert.throws(() => prepareImport([{ ...products[0], price: { unsafe: true } }]), /inválidos/);
  assert.ok(prepareImport([{ ...products[0], price: -2 }]).errors.length);
});

test('importa formato exato da planilha operacional com R$, milhar US, SKU com espaço e enriquecimento automático', () => {
  const sheetCsv = [
    'Product ID,DESCRIÇÃO,STATUS,VALOR,CATEGORIA,SUBCATEGORIA,UNIDADE DE MEDIDA,EM ESTOQUE',
    'b99bcb59,CAJA MANGA,ATIVO,R$ 95.00,Frutífera,Mangas,UN,',
    'palmeira-1,PALMEIRA AZUL,ATIVO,"R$ 1,000.00",Plantas / Mudas,Palmeiras,UN,25',
    'Tuia stritica,TUIA STRITICA,ATIVO,149.0,Plantas / Mudas,Coníferas,,',
  ].join('\r\n');

  const plan = prepareImport(sheetCsv);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.products.length, 3);

  const caja = plan.products[0];
  assert.equal(caja.sku, 'b99bcb59');
  assert.equal(caja.price, 95);
  assert.equal(caja.stockQuantity, 50); // padrão quando vazio
  assert.ok(caja.imageUrl.startsWith('https://images.unsplash.com/'));
  assert.ok(caja.cuidados_basicos.length > 0);
  assert.ok(caja.descriptionAi.length > 0);

  const palmeira = plan.products[1];
  assert.equal(palmeira.sku, 'palmeira-1');
  assert.equal(palmeira.price, 1000);
  assert.equal(palmeira.stockQuantity, 25);
  assert.ok(palmeira.imageUrl.length > 0);

  const tuia = plan.products[2];
  assert.equal(tuia.sku, 'Tuia stritica');
  assert.equal(tuia.price, 149);
  assert.equal(tuia.unit, 'UN');
});

