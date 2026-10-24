const test = require('node:test');
const assert = require('node:assert/strict');
const { watchMetaCatalog } = require('../src/services/meta-catalog-watch');
const { eligibleForMeta, internalProduct } = require('../src/services/meta-catalog-sync.service');
const { actualPhotoFixture } = require('./helpers/actual-photo-fixture');

test('internal financial items and Pets cannot be published by a mistaken review', () => {
  const review = { approved: true, reviewedBy: 'isolated-reviewer', reviewedAt: '2026-10-23', policyVersion: 'isolated', category: 'PERMITTED_PLANT_OR_GARDEN_PRODUCT' };
  for (const item of [{ name: 'Troco do dia' }, { name: 'Recebimento' }, { name: 'Outro', category: 'TROCO DO DIA' }, { name: 'Coelho', category: 'Pets' }]) assert.equal(eligibleForMeta({ ...item, metaCommerceReview: review }), false);
  assert.equal(internalProduct({ name: 'Rúcula', category: 'Horta' }), false);
  const { restrictedProduct, policyIdentity } = require('../src/services/meta-catalog-sync.service');
  assert.equal(restrictedProduct({ name: 'Bico de papagaio - flor do Natal', category: 'Plantas / Mudas' }), false);
  assert.equal(restrictedProduct({ name: 'Rabo de gato', category: 'Plantas / Mudas' }), false);
  assert.equal(restrictedProduct({ name: 'Papagaio', category: 'Pets' }), true);
  const reviewed = { id: 'arugula', name: 'Rúcula', category: 'Horta', metaCommerceReview: { ...review }, ...actualPhotoFixture('arugula') };
  reviewed.metaCommerceReview.productIdentity = policyIdentity(reviewed);
  assert.equal(eligibleForMeta(reviewed), true);
  assert.equal(eligibleForMeta({ ...reviewed, name: 'Outro produto' }), false);
});

test('local watch is explicitly gated and never enables a hosted listener', t => {
  const previous = { env: process.env.NODE_ENV, watch: process.env.WHATSAPP_META_LOCAL_WATCH_ENABLED };
  t.after(() => {
    process.env.NODE_ENV = previous.env;
    if (previous.watch === undefined) delete process.env.WHATSAPP_META_LOCAL_WATCH_ENABLED; else process.env.WHATSAPP_META_LOCAL_WATCH_ENABLED = previous.watch;
  });
  const repository = { firestore: { collection: () => { throw new Error('listener must remain disabled'); } } };
  process.env.NODE_ENV = 'production'; process.env.WHATSAPP_META_LOCAL_WATCH_ENABLED = 'true';
  assert.doesNotThrow(() => watchMetaCatalog(repository)());
  process.env.NODE_ENV = 'development'; process.env.WHATSAPP_META_LOCAL_WATCH_ENABLED = 'false';
  assert.doesNotThrow(() => watchMetaCatalog(repository)());
});

test('local Firestore changes queue the official outbox and removal invalidates a previously approved product', async t => {
  const previous = { env: process.env.NODE_ENV, watch: process.env.WHATSAPP_META_LOCAL_WATCH_ENABLED };
  t.after(() => { process.env.NODE_ENV = previous.env; if (previous.watch === undefined) delete process.env.WHATSAPP_META_LOCAL_WATCH_ENABLED; else process.env.WHATSAPP_META_LOCAL_WATCH_ENABLED = previous.watch; });
  process.env.NODE_ENV = 'development'; process.env.WHATSAPP_META_LOCAL_WATCH_ENABLED = 'true';
  let listener;
  let closed = false;
  const calls = [];
  const errors = [];
  const repository = { firestore: { collection: name => {
    assert.equal(name, 'products');
    return { onSnapshot: callback => { listener = callback; return () => { closed = true; }; } };
  } } };
  const sync = { store: { read: async () => ({ enabled: true, initialSyncAuthorizedAt: 'isolated' }) }, queue: async id => { calls.push(id); } };
  const stop = watchMetaCatalog(repository, { sync, onError: error => errors.push(error) });
  const approved = { id: 'approved', name: 'Rúcula', category: 'Horta', metaCommerceReview: { approved: true, reviewedBy: 'isolated', reviewedAt: 'isolated', policyVersion: 'isolated', category: 'PERMITTED_PLANT_OR_GARDEN_PRODUCT' }, ...actualPhotoFixture('approved') };
  listener({ docChanges: () => [
    { type: 'added', doc: { id: 'approved', data: () => approved } },
    { type: 'added', doc: { id: 'unreviewed', data: () => ({ name: 'Não revisado' }) } },
  ] });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['approved']);
  listener({ docChanges: () => [{ type: 'modified', doc: { id: 'approved', data: () => ({ ...approved, updatedAt: 'later', tagsAi: 'metadata only' }) } }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['approved']);
  listener({ docChanges: () => [{ type: 'removed', doc: { id: 'approved', data: () => approved } }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['approved', 'approved']);
  stop(); assert.equal(closed, true); assert.deepEqual(errors, []);
});

test('disabled notification worker leaves catalog jobs untouched while ordinary notifications continue', async t => {
  const { FirestoreRepository } = require('../src/database/firestore.repository');
  const { PdvRepository } = require('../src/orders/pdv.repository');
  const { PdvService } = require('../src/orders/pdv.service');
  const { MetaCatalogSyncService } = require('../src/services/meta-catalog-sync.service');
  const previous = process.env.WHATSAPP_META_SYNC_ENABLED;
  t.after(() => { if (previous === undefined) delete process.env.WHATSAPP_META_SYNC_ENABLED; else process.env.WHATSAPP_META_SYNC_ENABLED = previous; });
  const repository = new FirestoreRepository({ isInMemory: true });
  const store = new PdvRepository(repository);
  const id = await new MetaCatalogSyncService(repository).queue('isolated-product', { id: 'isolated-admin' });
  await store.transaction(async tx => tx.set('pdv_outbox', 'ordinary', { id: 'ordinary', kind: 'conversation-native', status: 'PENDING' }));
  const service = new PdvService({ repository: store });
  const delivered = [];
  service.deliver = async jobId => { delivered.push(jobId); await store.updateMessage(jobId, { status: 'SENT' }); };
  process.env.WHATSAPP_META_SYNC_ENABLED = 'false';
  await service.retryMessages();
  assert.deepEqual(delivered, ['ordinary']);
  assert.equal((await store.read('pdv_outbox', id)).status, 'CATALOG_PENDING');
  process.env.WHATSAPP_META_SYNC_ENABLED = 'true';
  await service.retryMessages();
  assert.deepEqual(delivered, ['ordinary', id]);
});

test('same source projection after reconnect does not create another outbox generation', async () => {
  const { FirestoreRepository } = require('../src/database/firestore.repository');
  const { MetaCatalogSyncService } = require('../src/services/meta-catalog-sync.service');
  const sync = new MetaCatalogSyncService(new FirestoreRepository({ isInMemory: true }));
  const fingerprint = 'a'.repeat(64);
  const id = await sync.queue('isolated-product', { id: 'local-firestore-watch' }, { sourceFingerprint: fingerprint });
  const before = await sync.store.read('pdv_outbox', id);
  await sync.queue('isolated-product', { id: 'local-firestore-watch' }, { sourceFingerprint: fingerprint });
  assert.equal((await sync.store.read('pdv_outbox', id)).requestedGeneration, before.requestedGeneration);
  await sync.queue('isolated-product', { id: 'local-firestore-watch' }, { sourceFingerprint: 'b'.repeat(64) });
  assert.equal((await sync.store.read('pdv_outbox', id)).requestedGeneration, before.requestedGeneration + 1);
});

test('provider-rejected eggs remain saleable in the store but cannot be republished by a metadata update', () => {
  const { commercialProduct } = require('../src/catalog/commercial-product');
  const { projection } = require('../src/services/meta-catalog-sync.service');
  const { missingReason } = require('../scripts/report-meta-catalog');
  const product = { id: 'isolated-eggs', name: 'CARTELA DE OVOS 12 OVOS', category: 'Hortifrutti', status: 'ATIVO',
    price: 12, stockQuantity: 0, publicDescription: 'Cartela com 12 ovos. Venda por cartela.',
    metaCommerceReview: { approved: false, category: 'NOT_APPROVED', reasonCode: 'META_REJECTED_REQUIRES_REVIEW' } };
  assert.equal(commercialProduct(product).active, true);
  assert.equal(commercialProduct(product).priceMinor, 1200);
  assert.deepEqual(projection(product, product.id, 'https://isolated.invalid', { stockControlEnabled: false }), { retailer_id: product.id, availability: 'discontinued' });
  assert.deepEqual(projection({ ...product, updatedAt: 'later', tagsAi: 'edit' }, product.id, 'https://isolated.invalid'), { retailer_id: product.id, availability: 'discontinued' });
  assert.equal(missingReason(product)[0], 'REJEITADO_PELA_META_AGUARDANDO_REVISAO');
});
