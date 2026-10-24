const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeProductInformation } = require('../src/catalog/registered-product-content');
const { normalizeProductMedia, reviewExternalMedia } = require('../src/catalog/product-media');
const { toProduct } = require('../src/storefront/existing-store');
const { toCashierProduct } = require('../src/catalog/cashier-product-details');
const { normalizeCatalogItem } = require('../src/catalog/normalize-catalog-item');
const { projection } = require('../src/services/meta-catalog-sync.service');
const { actualPhotoFixture } = require('./helpers/actual-photo-fixture');
const actor = { id: 'isolated-staff', role: 'ADMIN' };
function licensed(product, code = 'CC0') {
  return { version: 1, entries: reviewExternalMedia([{ url: 'https://images.example.org/product.jpg', licenseCode: code,
    licenseUrl: 'https://licenses.example.org/license', attribution: 'Autor da foto', rightsConfirmed: true, productMatchConfirmed: true }], product, actor) };
}
test('structured product information is identical in storefront, cashier and WhatsApp projections', () => {
  const product = { id: 'p', sku: 'sku-p', name: 'Vaso', price: 14, source: 'MANUAL', stockQuantity: 5, reservedQuantity: 2,
    description: 'Vaso de cerâmica.', descriptionAi: 'Texto antigo.', scientificName: 'Nome confirmado', rega: 'Conforme substrato',
    specifications: { material: { label: 'Material', value: 'Cerâmica' }, height: 14, width: { label: 'Largura', value: 20, unit: 'cm' }, colors: ['Verde', 'Branco'], broken: { label: 'Sem valor' } } };
  const before = structuredClone(product);
  const storefront = toProduct(product), cashier = toCashierProduct(product), whatsapp = normalizeCatalogItem(product);
  assert.deepEqual(storefront.productInfo, cashier.productInfo); assert.deepEqual(cashier.productInfo, whatsapp.productInfo);
  assert.equal(storefront.productInfo.description, product.description);
  assert.deepEqual(storefront.inventory, { physical: 5, reserved: 2, available: 3 });
  assert.deepEqual(cashier.inventory, storefront.inventory);
  assert.ok(cashier.details.some(row => row.label === 'Material' && row.value === 'Cerâmica'));
  assert.ok(cashier.details.some(row => row.value === '14'));
  assert.ok(cashier.details.some(row => row.value === '20 cm'));
  assert.equal(storefront.specifications.width.unit, 'cm');
  assert.ok(!JSON.stringify(cashier.details).includes('[object Object]'));
  assert.equal(cashier.sku, 'sku-p'); assert.deepEqual(product, before);
});
test('imported unreviewed text is retained in source but not silently certified', () => {
  const product = { name: 'Vaso', source: 'CSV_IMPORT', descriptionAi: 'Informação não confirmada', specifications: { invented: 'unknown' } };
  const info = normalizeProductInformation(product);
  assert.equal(info.description, 'Vaso'); assert.deepEqual(info.specifications, []);
  assert.equal(product.descriptionAi, 'Informação não confirmada');
});
test('licensed external photographs share the contract without being represented as Storage', async () => {
  const product = { id: 'p', name: 'Vaso', price: 14 };
  product.productMedia = licensed(product);
  assert.equal(normalizeProductMedia(product).entries[0].source, 'EXTERNAL');
  assert.equal(toProduct(product).imageUrl, toCashierProduct(product).imageUrl);
  assert.equal(await require('../src/agent/product-image').verifiedProductImage(product, { fetcher: async () => { throw new Error('External server fetch forbidden'); } }), product.productMedia.entries[0].url);
});
test('manual photographs take priority and secondary authorized photographs are preserved', () => {
  const product = { id: 'p', name: 'Vaso', ...actualPhotoFixture('p') };
  const manual = normalizeProductMedia(product).entries[0];
  product.productMedia = licensed(product);
  product.productMedia.entries.push(manual);
  const media = normalizeProductMedia(product);
  assert.equal(media.primaryUrl, manual.url); assert.equal(media.entries.length, 2);
});
test('external sources require explicit rights, identity, license and authenticated review', () => {
  const product = { id: 'p', name: 'Vaso', imageUrl: 'https://images.example.org/product.jpg' };
  assert.equal(normalizeProductMedia(product).entries.length, 0);
  assert.throws(() => reviewExternalMedia([{}], product, actor), /Confirme/);
  assert.throws(() => reviewExternalMedia([], product, { id: 'customer', role: 'CLIENTE' }), /ADMIN/);
  product.productMedia = licensed(product);
  assert.equal(normalizeProductMedia({ ...product, id: 'other' }).entries.length, 0);
  assert.equal(normalizeProductMedia({ ...product, name: 'Outra espécie' }).entries.length, 0);
});
test('a canonical empty gallery does not resurrect a stale legacy photo', () => {
  const product = { id: 'p', ...actualPhotoFixture('p'), productMedia: { version: 1, entries: [] } };
  assert.equal(normalizeProductMedia(product).entries.length, 0);
});
test('Meta gets the same licensed primary image and required attribution', () => {
  const product = { id: 'p', name: 'Vaso', category: 'Jardinagem', price: 14,
    metaCommerceReview: { approved: true, reviewedBy: actor.id, reviewedAt: '2026-10-24', policyVersion: 'isolated', category: 'PERMITTED_PLANT_OR_GARDEN_PRODUCT' } };
  product.productMedia = licensed(product, 'CC_BY');
  const meta = projection(product, product.id, 'https://lojaconflora.web.app');
  assert.equal(meta.image_url, toCashierProduct(product).imageUrl); assert.match(meta.description, /Autor da foto/);
});

test('metadata writes preserve reservations and stale versions cannot overwrite a newer product', async () => {
  const { FirestoreRepository } = require('../src/database/firestore.repository');
  const { meteredFirestore } = require('./helpers/metered-firestore');
  const db = meteredFirestore({ 'products/p': { id: 'p', name: 'Vaso', price: 14, stockQuantity: 5, reservedQuantity: 2, updatedAt: 'v1' } });
  const repo = new FirestoreRepository({ firestoreInstance: db });
  await repo.saveProduct({ id: 'p', name: 'Vaso novo', reservedQuantity: 0, stockQuantity: 5 }, { expectedUpdatedAt: 'v1' });
  assert.equal(db.data.get('products/p').reservedQuantity, 2);
  await assert.rejects(repo.saveProduct({ id: 'p', price: 1 }, { expectedUpdatedAt: 'v1' }), /produto mudou/);
  assert.equal(db.data.get('products/p').price, 14);
  await assert.rejects(repo.saveProduct({ id: 'p', stockQuantity: 1 }), /reservadas/);
  const transaction = db.runTransaction;
  db.runTransaction = work => { db.data.get('products/p').stockQuantity = 3; return transaction(work); };
  await assert.rejects(repo.saveProduct({ id: 'p', stockQuantity: 8 }), /estoque mudou/);
  assert.equal(db.data.get('products/p').stockQuantity, 3);
});

test('metadata migration plan is deterministic, preserves Firestore and never copies commercial fields', () => {
  const { planMetadataMigration } = require('../scripts/plan-product-metadata-migration');
  const current = [{ id: 'p', name: 'Vaso', price: 14, stockQuantity: 5, descriptionAi: 'Texto atual' }];
  const historical = [{ id: 'p', price: 1, stockQuantity: 99, descriptionAi: 'Texto antigo', watering: 'A confirmar', images: ['unreviewed'] }];
  const first = planMetadataMigration(current, historical);
  assert.deepEqual(first, planMetadataMigration(current, historical));
  assert.deepEqual(first.changes.map(row => [row.field, row.action]), [['descriptionAi', 'PRESERVE_FIRESTORE'], ['watering', 'REQUIRES_STAFF_REVIEW']]);
  assert.equal(current[0].price, 14);
});
