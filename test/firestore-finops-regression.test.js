const test = require('node:test');
const assert = require('node:assert/strict');
const { meteredFirestore } = require('./helpers/metered-firestore');
const { FirestoreRepository } = require('./helpers/repository-fixture');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { IncomingMessageService } = require('../src/services/incoming-message.service');
const { compactIncomingRecord, conversationExpiry } = require('../src/database/retention');
const { normalizeExistingCheckout, installExistingStore } = require('../src/storefront/existing-store');
const { StorefrontAnalyticsService } = require('../src/services/storefront-analytics.service');
const { installRequestProtection } = require('../src/security/request-protection');

const setup = initial => {
  const db = meteredFirestore(initial);
  const repo = new FirestoreRepository({ firestoreInstance: db, isInMemory: true });
  if (!db.data.has('store_settings/storefront')) db.data.set('store_settings/storefront', repo.storefrontSettings);
  return { db, repo, store: new PdvRepository(repo) };
};
const request = () => ({ path: '/api/storefront/orders', body: {
  customer: { name: 'Cliente teste', phone: '64999999999' }, fulfillment: 'pickup', paymentMethod: 'PIX',
  items: [{ productId: 'p', quantity: 1 }, { productId: 'p', quantity: 1 }],
} });

test('web checkout reads only requested IDs and always obtains current stock, price and settings', async () => {
  const { repo, db } = setup({
    'products/p': { name: 'Produto', price: 12, stockQuantity: 5, unit: 'UN', status: 'ATIVO' },
    'products/unrelated': { name: 'Outro', price: 9, stockQuantity: 10 },
    'store_settings/inventory': { stockControlEnabled: true },
  });
  repo.getAllProducts = () => assert.fail('Full catalog scan during checkout');
  let req = request(); await normalizeExistingCheckout(req, repo);
  assert.equal(db.metrics.reads, 3); // storefront settings, inventory policy, one unique product
  assert.equal(req.body.subtotal, 24);
  db.data.get('products/p').price = 18;
  req = request(); await normalizeExistingCheckout(req, repo); assert.equal(req.body.subtotal, 36);
  db.data.get('products/p').stockQuantity = 1;
  await assert.rejects(normalizeExistingCheckout(request(), repo), /indisponível/);
  db.data.get('store_settings/inventory').stockControlEnabled = false;
  await normalizeExistingCheckout(request(), repo);
});

test('public catalog shares a short snapshot and invalidates after a product edit', async () => {
  const { repo, db } = setup({ 'products/p': { name: 'Produto', price: 12, unit: 'UN' } });
  repo.getAllProducts = async () => (await db.collection('products').get()).docs.map(doc => ({ ...doc.data(), id: doc.id }));
  repo.getSalesOrders = async () => [];
  let configReads = 0, inventoryReads = 0;
  const collection = db.collection;
  db.collection = name => {
    const query = collection(name); const doc = query.doc;
    query.doc = id => {
      if (name === 'store_settings') { if (id === 'storefront') configReads++; if (id === 'inventory') inventoryReads++; }
      return doc(id);
    };
    return query;
  };
  const routes = new Map(); const app = { locals: {}, get: (path, handler) => routes.set(path, handler), post() {}, put() {}, use() {} };
  installExistingStore(app, { repository: repo });
  let body;
  const res = { set() { return this; }, json(value) { body = value; } };
  const next = error => { throw error; };
  await routes.get('/api/storefront/catalog')({ query: {} }, res, next);
  assert.equal(configReads, 1); assert.equal(inventoryReads, 1);
  assert.equal(body.products[0].price.amountMinor, 1200);
  await routes.get('/api/storefront/catalog')({ query: {} }, res, next);
  assert.equal(configReads, 1); assert.equal(inventoryReads, 1);
  db.data.get('products/p').price = 20;
  app.locals.publicCatalogCache.invalidate();
  await routes.get('/api/storefront/catalog')({ query: {} }, res, next);
  assert.equal(configReads, 2); assert.equal(body.products[0].price.amountMinor, 2000);
});

test('completed inbox compaction preserves deduplication indefinitely and never compacts active work', async () => {
  const now = Date.now();
  const original = { id: 'message', payload: { phone: 'private', message: 'private' }, status: 'COMPLETED', completedAt: new Date(now - 40 * 86400000).toISOString(), attempts: 2 };
  const compact = compactIncomingRecord(original, { now });
  assert.equal(compact.payload, undefined); assert.equal(compact.expiresAt, null);
  const { repo, db } = setup(); const incoming = new IncomingMessageService(repo);
  const id = incoming.id('wamid.old'); db.data.set(`incoming_messages/${id}`, { ...compact, id });
  await incoming.accept({ messageId: 'wamid.old', message: 'replay' });
  assert.equal((await incoming.claim('wamid.old')).completed, true);
  assert.equal(db.metrics.writes, 0);
  for (const status of ['PENDING', 'PROCESSING', 'NEEDS_RECONCILIATION']) assert.equal(compactIncomingRecord({ ...original, status }, { now }), null);
  assert.equal(compactIncomingRecord({ ...original, completedAt: undefined }, { now }), null);
});

test('conversation expiry is opt-in and scoped to per-message history, never parent sessions', () => {
  assert.equal(conversationExpiry({}), null);
  assert.equal(conversationExpiry({ WHATSAPP_HISTORY_RETENTION_DAYS: '2' }), null);
  assert.equal(conversationExpiry({ WHATSAPP_HISTORY_RETENTION_DAYS: '90' }, 0).getTime(), 90 * 86400000);
  const plan = require('../config/firestore-retention-plan.json');
  assert.deepEqual(plan.ttl.map(row => row.collectionGroup), ['web_sessions', 'request_limits', 'whatsapp_delivery_events']);
  assert.ok(plan.neverDeleteAutomatically.includes('payment_proofs'));
  assert.ok(plan.neverDeleteAutomatically.includes('incoming_messages'));
});

test('incoming backoff prevents immediate retries and eventually quarantines persistent failure', async () => {
  const { repo, db } = setup(); const incoming = new IncomingMessageService(repo);
  await incoming.accept({ messageId: 'failing', message: 'test' });
  for (let n = 0; n < 12; n++) {
    const id = incoming.id('failing'); db.data.get(`incoming_messages/${id}`).nextAttemptAt = 0;
    const claim = await incoming.claim('failing');
    await incoming.finish(claim, new Error('offline'));
    if (n < 11) await assert.rejects(incoming.claim('failing'), /backoff/);
  }
  await assert.rejects(incoming.claim('failing'), /conferência/);
  const row = db.data.get(`incoming_messages/${incoming.id('failing')}`);
  assert.equal(row.status, 'NEEDS_RECONCILIATION'); assert.equal(row.expiresAt, null);
});

test('shared rejection cache saves repeated abuse reads without authorizing requests locally', async () => {
  const { repo, db } = setup(); const handlers = [];
  installRequestProtection({ use: (...args) => handlers.push(args.at(-1)) }, repo);
  const middleware = handlers[1];
  const hit = async () => {
    let code = 200;
    await middleware({ method: 'POST', path: '/chat', ip: '192.0.2.1', body: {} }, { setHeader() {}, status(n) { code = n; return this; }, json() {} }, () => {});
    return code;
  };
  for (let n = 0; n < 8; n++) assert.equal(await hit(), 200);
  assert.equal(await hit(), 429); const reads = db.metrics.reads, writes = db.metrics.writes;
  for (let n = 0; n < 100; n++) assert.equal(await hit(), 429);
  assert.equal(db.metrics.reads, reads); assert.equal(db.metrics.writes, writes);
});

test('WhatsApp callbacks update monotonically and repeated receipts do not write', async () => {
  const { store, db } = setup({ 'pdv_outbox/job': { id: 'job', status: 'SENT', providerMessageId: 'wamid.fixture', deliveryStatus: 'ACCEPTED' } });
  const callback = { id: 'wamid.fixture', status: 'delivered', timestamp: '1000' };
  await Promise.all([store.recordWhatsAppStatus(callback), store.recordWhatsAppStatus(callback)]);
  const writes = db.metrics.writes;
  assert.equal(writes, 2);
  await store.recordWhatsAppStatus(callback); assert.equal(db.metrics.writes, writes);
  await store.recordWhatsAppStatus({ ...callback, status: 'sent' });
  assert.equal(db.data.get('pdv_outbox/job').deliveryStatus, 'DELIVERED');
});

test('PDV subscribers share two listeners, replay latest snapshot and close once on last disconnect', () => {
  let starts = 0, stops = 0; const callbacks = [];
  const query = { where() { return this; }, limit() { return this; }, orderBy() { return this; }, onSnapshot(next) { starts++; callbacks.push(next); return () => { stops++; }; } };
  const repo = { firestore: { collection: () => query } }; const store = new PdvRepository(repo);
  let received = 0;
  const first = store.watchOpenOrders(() => { received++; });
  const second = store.watchOpenOrders(() => { received++; });
  assert.equal(starts, 2);
  callbacks[0]({ docs: [{ id: 'order', data: () => ({ status: 'PENDING' }) }] }); assert.equal(received, 0);
  callbacks[1]({ docs: [] }); assert.equal(received, 2);
  const third = store.watchOpenOrders(() => { received++; }); assert.equal(received, 3);
  first(); first(); second(); assert.equal(stops, 0); third(); assert.equal(stops, 2);
  const fresh = store.watchOpenOrders(() => {}); assert.equal(starts, 4); fresh();
});

test('concurrent dashboard requests share queries but subsequent paid totals are read afresh', async () => {
  const { repo } = setup(); let queries = 0, total = 10;
  repo.getStorefrontAnalyticsSummary = async () => ({ visitors: 1, eventCounts: {}, topProducts: [], campaigns: [] });
  repo.getExecutiveRecordsForRange = async () => { queries++; await new Promise(resolve => setImmediate(resolve)); return [{ id: 'order', source: 'WEB_CATALOG', status: 'CONFIRMED', paymentStatus: 'APPROVED', paymentMethod: 'PIX', total, paidAt: new Date().toISOString() }]; };
  const service = new StorefrontAnalyticsService(repo, { env: {} });
  const reports = await Promise.all(Array.from({ length: 20 }, () => service.summary()));
  assert.equal(queries, 3); assert.ok(reports.every(row => row.revenue === 10));
  total = 20; assert.equal((await service.summary()).revenue, 20); assert.equal(queries, 6);
});

test('sales ranking pages and coalesces complete projections without caching commercial documents', async () => {
  const orders = Object.fromEntries(Array.from({ length: 1001 }, (_, i) => [`orders/${String(i).padStart(4, '0')}`, { status: 'CONFIRMED', items: [], privateField: 'excluded' }]));
  const { repo, db } = setup(orders);
  const results = await Promise.all(Array.from({ length: 20 }, () => repo.getSalesOrders()));
  assert.ok(results.every(rows => rows.length === 1001)); assert.equal(db.metrics.queries, 3);
  assert.equal(db.metrics.reads, 1001); assert.equal(results[0][0].privateField, undefined);
});

test('Pix expiration polling rotates beyond the first 500 open orders without dropping pending reservations', async () => {
  const initial = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`orders/${String(i).padStart(4, '0')}`, {
    status: 'AWAITING_PIX', pixExpiresAt: new Date(Date.now() + (i < 500 ? 3600000 : -3600000)).toISOString(),
  }]));
  const { store, db } = setup(initial);
  assert.equal((await store.expiredPixOrders()).length, 0);
  assert.equal((await store.expiredPixOrders())[0].id, '0500');
  assert.equal(db.metrics.writes, 0);
});

test('maintenance refuses mutation outside a local demo emulator before any database access', () => {
  const { spawnSync } = require('node:child_process');
  for (const [host, project] of [['', 'confloraai'], ['remote.test:8080', 'demo-safe'], ['127.0.0.1:8080', 'confloraai']]) {
    const result = spawnSync(process.execPath, ['scripts/inspect-firestore-retention.js', '--apply'], {
      env: { ...process.env, FIRESTORE_EMULATOR_HOST: host, GOOGLE_CLOUD_PROJECT: project }, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.status, 1); assert.match(result.stderr, /emulador|demo-/);
  }
});
