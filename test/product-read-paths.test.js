const test = require('node:test');
const assert = require('node:assert/strict');
const { FirestoreRepository } = require('./helpers/repository-fixture');
const { createApp } = require('../src/http/app');
const { dispatch } = require('./helpers/in-process-http');
const { meteredFirestore } = require('./helpers/metered-firestore');
const { actualPhotoFixture } = require('./helpers/actual-photo-fixture');

test('cursor reads at most limit+1 documents and never scans all pages', async () => {
  const db = meteredFirestore(Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`products/p${String(i).padStart(4, '0')}`, { name: 'Vaso', price: 10 }])));
  const repository = new FirestoreRepository({ firestoreInstance: db });
  const first = await repository.getProductsPage({ limit: 24 });
  assert.equal(db.metrics.reads, 25); assert.equal(first.products.length, 24);
  assert.equal(first.pagination.nextCursor, 'p0023'); assert.equal(first.pagination.totalItems, null);
  const next = await repository.getProductsPage({ limit: 24, after: first.pagination.nextCursor });
  assert.equal(db.metrics.reads, 50); assert.equal(next.products[0].id, 'p0024');
  await assert.rejects(repository.getProductsPage({ limit: 1000 }), /inválida/);
  await assert.rejects(repository.getProductsPage({ after: '../private' }), /inválida/);
  assert.equal(db.metrics.queries, 2);
});

test('real routes separate list/detail and cursor route never invokes the full-scan repository', async () => {
  const repository = new FirestoreRepository({ isInMemory: true });
  for (let i = 0; i < 30; i++) {
    const id = `p${String(i).padStart(3, '0')}`;
    await repository.saveProduct({ id, sku: `sku-${id}`, name: 'Vaso ' + i, price: 14, status: 'ATIVO', source: 'MANUAL', stockQuantity: 5,
      description: 'Descrição cadastrada pela equipe.', specifications: { material: { label: 'Material', value: 'Cerâmica' } }, ...actualPhotoFixture(id) });
  }
  const app = createApp({ messageService: { firestoreRepo: repository, catalogRepo: { items: [], invalidateCache() {} } } });
  const login = await dispatch(app, '/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'usr-edmar', pin: '1234' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const read = async url => { const response = await dispatch(app, url, { headers: { cookie } }); assert.equal(response.status, 200, url); return response.json(); };
  const full = await read('/api/storefront/catalog');
  const list = await read('/api/storefront/catalog?projection=list');
  assert.equal(list.products.length, 30); assert.ok(JSON.stringify(list).length < JSON.stringify(full).length);
  assert.equal(list.products[0].productInfo, undefined); assert.equal(list.products[0].detailsLoaded, false);
  const storefront = (await read('/api/storefront/products/p000')).product;
  const cashier = await read('/api/caixa/products/p000');
  assert.deepEqual(storefront.productInfo, cashier.productInfo);
  assert.equal(storefront.media.primaryUrl, cashier.media.primaryUrl);
  const cashierList = await read('/api/caixa/products?projection=list');
  assert.equal(cashierList[0].details, undefined); assert.equal(cashierList[0].media.primaryUrl, cashier.media.primaryUrl);
  repository.getAllProducts = async () => { throw new Error('Forbidden full scan'); };
  const page = await read('/api/storefront/catalog?limit=24');
  assert.equal(page.products.length, 24); assert.ok(page.pagination.hasMore);
  const second = await read('/api/storefront/catalog?limit=24&after=' + page.pagination.nextCursor);
  assert.equal(second.products.length, 6); assert.equal(second.pagination.hasMore, false);
  const inventory = await read('/api/inventory?limit=10');
  assert.equal(inventory.products.length, 10); assert.equal(inventory.pagination.filterScope, 'SCANNED_PAGE');
});

test('storefront, inventory and cashier share one read projection but mutations invalidate it', async () => {
  const repository = new FirestoreRepository({ isInMemory: true });
  await repository.saveProduct({ id: 'p', name: 'Vaso', price: 14, stockQuantity: 5, status: 'ATIVO' });
  let reads = 0;
  const getAll = repository.getAllProducts.bind(repository);
  repository.getAllProducts = async () => { reads++; return getAll(); };
  const { CatalogRepository } = require('../src/catalog/catalog.repository');
  const catalog = new CatalogRepository({ firestoreRepo: repository });
  const app = createApp({ messageService: { firestoreRepo: repository, catalogRepo: catalog } });
  const login = await dispatch(app, '/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'usr-edmar', pin: '1234' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  for (const route of ['/api/storefront/catalog?projection=list', '/api/inventory', '/api/caixa/products?projection=list']) {
    const response = await dispatch(app, route, { headers: { cookie } });
    assert.equal(response.status, 200); await response.json();
  }
  assert.equal(reads, 1);
  const update = await dispatch(app, '/api/admin/products', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'p', price: 17 }) });
  assert.equal(update.status, 200);
  const response = await dispatch(app, '/api/caixa/products?projection=list', { headers: { cookie } });
  assert.equal((await response.json())[0].price, 17); assert.equal(reads, 2);
  assert.equal((await repository.getProductById('p')).stockQuantity, 5);
});

test('authenticated media/content review reaches every real consumer and clearing text never resurrects an old alias', async () => {
  const repository = new FirestoreRepository({ isInMemory: true });
  await repository.saveProduct({ id: 'p', name: 'Vaso', price: 14, stockQuantity: 5, status: 'ATIVO', source: 'MANUAL', description: 'Texto antigo',
    specifications: { width: { label: 'Largura', value: 20, unit: 'cm' } } });
  const app = createApp({ messageService: { firestoreRepo: repository, catalogRepo: { items: [], invalidateCache() {} } } });
  const login = await dispatch(app, '/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'usr-edmar', pin: '1234' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const edit = body => dispatch(app, '/api/admin/products', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json', 'X-Product-Content-Confirmed': 'true' }, body: JSON.stringify(body) });
  assert.equal((await edit({ id: 'p', externalMedia: [{ url: 'https://images.example.org/p.jpg' }] })).status, 400);
  assert.equal((await repository.getProductById('p')).productMedia, undefined);
  const response = await edit({ id: 'p', descriptionAi: 'Descrição atual', externalMedia: [{ url: 'https://images.example.org/p.jpg',
    licenseCode: 'CC_BY', licenseUrl: 'https://licenses.example.org/cc-by', attribution: 'Fotógrafo autorizado', rightsConfirmed: true, productMatchConfirmed: true }] });
  assert.equal(response.status, 200);
  for (const url of ['/api/storefront/products/p', '/api/caixa/products/p']) {
    const body = await (await dispatch(app, url, { headers: { cookie } })).json();
    const product = body.product || body;
    assert.equal(product.productInfo.description, 'Descrição atual');
    assert.equal(product.media.primaryUrl, 'https://images.example.org/p.jpg');
    assert.equal(product.productInfo.specifications[0].unit, 'cm');
  }
  assert.equal((await edit({ id: 'p', descriptionAi: '' })).status, 200);
  const product = (await (await dispatch(app, '/api/storefront/products/p')).json()).product;
  assert.equal(product.description, 'Vaso');
  const photos = await (await dispatch(app, '/api/products/p/photos')).json();
  assert.equal(photos.photos[0].url, product.media.primaryUrl);
  assert.equal(photos.photos[0].source, 'EXTERNAL');
  assert.equal((await repository.getProductById('p')).stockQuantity, 5);
});
