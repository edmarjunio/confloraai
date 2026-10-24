const test = require('node:test');
const assert = require('node:assert/strict');
const { actualProductImages, actualProductPhotoFields } = require('../src/catalog/actual-product-photo');
const { normalizeCatalogItem } = require('../src/catalog/normalize-catalog-item');
const { toProduct } = require('../src/storefront/existing-store');
const { projection } = require('../src/services/meta-catalog-sync.service');
const { actualPhotoFixture } = require('./helpers/actual-photo-fixture');

test('all main catalog projections share the attested Storage image and authoritative zero price', () => {
  const product = { id: 'p', name: 'Produto real', price: 0, valor_num: 99, status: 'ATIVO', ...actualPhotoFixture('p') };
  assert.equal(normalizeCatalogItem(product).imageUrl, toProduct(product).imageUrl);
  assert.equal(normalizeCatalogItem(product).price, 0);
  assert.equal(toProduct(product).price.amountMinor, 0);
});

test('internal cash entries remain in source records but cannot become retail products', () => {
  const { commercialProduct, commercialLine } = require('../src/catalog/commercial-product');
  for (const name of ['TROCO DO DIA', 'RECEBIMENTO']) {
    const raw = { id: 'internal', name, price: 10, status: 'ATIVO' };
    assert.equal(commercialProduct(raw).active, false);
    assert.equal(toProduct(raw).isAvailable, false);
    assert.throws(() => commercialLine(raw, 1), /inválida/);
    assert.equal(raw.status, 'ATIVO');
  }
});
test('reference/generated/cross-product/cross-bucket images never enter listings', () => {
  const original = { id: 'p', ...actualPhotoFixture('p') };
  for (const product of [{ ...original, imageProvenance: null }, { ...original, imageIsIllustrative: true },
    { ...original, id: 'other' }, { ...original, imageProvenance: { ...original.imageProvenance, storagePaths: [] } }]) {
    assert.deepEqual(actualProductImages(product), []);
    const fields = actualProductPhotoFields({ ...product, image: 'https://reference.example/photo.jpg', fotos: ['old'] });
    assert.equal(fields.image, ''); assert.deepEqual(fields.fotos, []);
  }
});
test('Meta selects only approved actual photos even when an older reference is first', () => {
  const fixture = actualPhotoFixture('p');
  const product = { id: 'p', name: 'Vaso', price: 10, category: 'Jardinagem', status: 'ATIVO', ...fixture,
    images: ['https://reference.example/old.jpg', fixture.imageUrl],
    metaCommerceReview: { approved: true, reviewedBy: 'staff', reviewedAt: '2026-10-24', policyVersion: 'test', category: 'PERMITTED_PLANT_OR_GARDEN_PRODUCT' } };
  assert.equal(projection(product, 'p', 'https://lojaconflora.web.app').image_url, fixture.imageUrl);
});
test('unreviewed generated product detail aliases are suppressed without changing source documents', () => {
  const raw = { id: 'p', name: 'Vaso', price: 10, descriptionAi: 'Inventado', habitat: 'Inventado', food: 'Inventado',
    iluminaçao: 'Inventado', specifications: { material: 'Inventado' } };
  const normalized = normalizeCatalogItem(raw);
  assert.equal(normalized.descriptionAi, ''); assert.equal(normalized.habitat, ''); assert.equal(normalized.food, '');
  assert.equal(toProduct(raw).description, 'Vaso'); assert.equal(raw.descriptionAi, 'Inventado');
});

test('authenticated upload propagates the same real Storage photo to storefront, cashier and inventory; price edit preserves it', async () => {
  const { FirestoreRepository } = require('./helpers/repository-fixture');
  const { isolatedPhotoStorage } = require('./helpers/actual-photo-fixture');
  const { dispatch } = require('./helpers/in-process-http');
  const { createApp } = require('../src/http/app');
  const repo = new FirestoreRepository({ isInMemory: true, productImageStorage: isolatedPhotoStorage() });
  await repo.saveProduct({ id: 'p', name: 'Produto real', price: 10, status: 'ATIVO', stockQuantity: 2 });
  const app = createApp({ messageService: { firestoreRepo: repo, catalogRepo: { items: [], invalidateCache() {} } } });
  const login = await dispatch(app, '/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'usr-edmar', pin: '1234' }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const photo = await require('sharp')({ create: { width: 100, height: 100, channels: 3, background: 'green' } }).png().toBuffer();
  const upload = async confirmed => dispatch(app, '/api/admin/products/p/photo', { method: 'POST', headers: { cookie,
    'Content-Type': 'application/octet-stream', 'X-Photo-Content-Type': 'image/png', ...(confirmed ? { 'X-Photo-Actual-Product': 'true' } : {}) }, body: photo });
  assert.equal((await upload(false)).status, 400);
  const result = await upload(true); assert.equal(result.status, 200);
  const saved = await repo.getProductById('p');
  assert.ok(actualProductImages(saved).length);
  const edit = await dispatch(app, '/api/admin/products', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'p', name: 'Produto real', price: 11, images: [], imageUrl: '' }) });
  assert.equal(edit.status, 200);
  assert.equal((await repo.getProductById('p')).imageUrl, saved.imageUrl);
  for (const [url, select] of [
    ['/api/storefront/catalog', body => body.products], ['/api/caixa/products', body => body],
    ['/api/inventory', body => body.products || body],
  ]) {
    const response = await dispatch(app, url, { headers: { cookie } });
    assert.equal(response.status, 200, url);
    const product = select(await response.json()).find(row => row.id === 'p');
    assert.equal(product.imageUrl, saved.imageUrl, url);
    assert.equal(typeof product.price === 'object' ? product.price.amountMinor : product.price * 100, 1100, url);
  }
});
