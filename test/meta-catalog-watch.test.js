const test = require('node:test');
const assert = require('node:assert/strict');
const { watchMetaCatalog } = require('../src/services/meta-catalog-watch');
const { eligibleForMeta, internalProduct } = require('../src/services/meta-catalog-sync.service');

test('internal financial items and Pets cannot be published by a mistaken review', () => {
  const review = { approved: true, reviewedBy: 'isolated-reviewer', reviewedAt: '2026-10-23', policyVersion: 'isolated', category: 'PERMITTED_PLANT_OR_GARDEN_PRODUCT' };
  for (const item of [{ name: 'Troco do dia' }, { name: 'Recebimento' }, { name: 'Outro', category: 'TROCO DO DIA' }, { name: 'Coelho', category: 'Pets' }]) assert.equal(eligibleForMeta({ ...item, metaCommerceReview: review }), false);
  assert.equal(internalProduct({ name: 'Rúcula', category: 'Horta' }), false);
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
  const approved = { name: 'Rúcula', category: 'Horta', metaCommerceReview: { approved: true, reviewedBy: 'isolated', reviewedAt: 'isolated', policyVersion: 'isolated', category: 'PERMITTED_PLANT_OR_GARDEN_PRODUCT' } };
  listener({ docChanges: () => [
    { type: 'added', doc: { id: 'approved', data: () => approved } },
    { type: 'added', doc: { id: 'unreviewed', data: () => ({ name: 'Não revisado' }) } },
  ] });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['approved']);
  listener({ docChanges: () => [{ type: 'removed', doc: { id: 'approved', data: () => approved } }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['approved', 'approved']);
  stop(); assert.equal(closed, true); assert.deepEqual(errors, []);
});
