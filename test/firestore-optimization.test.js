const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { meteredFirestore } = require('./helpers/metered-firestore');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { PdvService } = require('../src/orders/pdv.service');
const { IncomingMessageService } = require('../src/services/incoming-message.service');
const { StorefrontAnalyticsService, campaignLabel } = require('../src/services/storefront-analytics.service');
const { compactOutboxRecord } = require('../src/database/retention');
const { createWebSessions } = require('../src/security/web-session');
const { installRequestProtection } = require('../src/security/request-protection');
const { Ga4PurchaseClient } = require('../src/integrations/ga4-purchase.client');

function setup(initial = {}) {
  const db = meteredFirestore(initial);
  const base = new FirestoreRepository({ firestoreInstance: db, isInMemory: true });
  return { db, base, store: new PdvRepository(base) };
}
function ga4() {
  return async body => {
    const dimension = body.dimensions?.[0]?.name;
    if (!dimension) return { rows: [{ metricValues: [{ value: '10' }] }] };
    if (dimension === 'eventName') return { rows: [{ dimensionValues: [{ value: 'page_view' }], metricValues: [{ value: '15' }] }] };
    return { rows: [] };
  };
}
const gaEnv = { GA4_PROPERTY_ID: '123', STOREFRONT_ANALYTICS_MODE: 'ga4', GA4_REPORTS_VALIDATED: 'true' };

test('checkout reads only unique requested products; failure cannot use stale memory', async () => {
  const { db, base } = setup({ 'products/a': { price: 12 }, 'products/b': { price: 20 } });
  assert.deepEqual((await base.getProductsByIds(['a', 'a'])).map(row => row.price), [12]);
  assert.equal(db.metrics.reads, 1);
  db.data.set('products/a', { price: 15 });
  assert.equal((await base.getProductsByIds(['a']))[0].price, 15);
  await assert.rejects(base.getProductsByIds(['a/b']), /inválido/);
  db.getAll = async () => { throw new Error('unavailable'); };
  base.inMemoryProducts.set('a', { price: 1 });
  await assert.rejects(base.getProductsByIds(['a']), /unavailable/);
});

test('rotating bounded queue pages reach jobs behind leased/delayed jobs without a composite index', async () => {
  const { store, db } = setup(Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`pdv_outbox/${String(i).padStart(4, '0')}`, { status: 'PENDING', nextAttemptAt: i < 200 ? Date.now() + 60000 : 0 }])));
  assert.equal((await store.scanPage('pdv_outbox', 'status', 'PENDING')).length, 100);
  assert.equal((await store.scanPage('pdv_outbox', 'status', 'PENDING'))[0].id, '0100');
  assert.equal((await store.scanPage('pdv_outbox', 'status', 'PENDING'))[0].id, '0200');
  assert.equal((await store.scanPage('pdv_outbox', 'status', 'PENDING'))[0].id, '0000');
  assert.equal(db.metrics.reads, 350);
});

test('two repository instances claim once; stale owners cannot persist or send', async () => {
  const { base, store, db } = setup({ 'pdv_outbox/a': { id: 'a', status: 'PENDING', attempts: 0 } });
  const other = new PdvRepository(base);
  const [a, b] = await Promise.all([store.claimMessage('a'), other.claimMessage('a')]);
  assert.ok(a); assert.equal(b, null);
  db.data.set('pdv_outbox/a', { ...db.data.get('pdv_outbox/a'), leaseUntil: 0 });
  const c = await other.claimMessage('a');
  await assert.rejects(store.updateMessage('a', { status: 'SENDING' }, a.leaseOwner), /posse/);
  await other.updateMessage('a', { status: 'SENT' }, c.leaseOwner);
  assert.equal(await store.claimMessage('a'), null);
});

test('uncertain provider acceptance is never retried automatically after a restart', async () => {
  const { store, base } = setup({ 'pdv_outbox/a': { id: 'a', kind: 'conversation-text', text: 'ok', recipient: '5564999991234', status: 'PENDING', attempts: 0 } });
  let calls = 0;
  const whatsapp = { sendTextMessage: async () => { calls++; throw new Error('timeout after acceptance'); } };
  await new PdvService({ repository: store, whatsapp }).deliver('a');
  const restarted = new PdvService({ repository: new PdvRepository(base), whatsapp });
  await restarted.retryMessages();
  assert.equal(calls, 1);
  assert.equal((await store.read('pdv_outbox', 'a')).status, 'NEEDS_RECONCILIATION');
});

test('crashed SENDING is quarantined; safe pre-send failures retain backoff', async () => {
  const { store } = setup({
    'pdv_outbox/a': { id: 'a', status: 'SENDING', sendingAt: new Date(Date.now() - 300000).toISOString(), leaseUntil: 0 },
    'pdv_outbox/b': { id: 'b', kind: 'conversation-text', text: 'ok', recipient: '5564999991234', status: 'PENDING', attempts: 0 },
  });
  let sends = 0;
  const service = new PdvService({ repository: store, whatsapp: { sendTextMessage: async () => { sends++; throw Object.assign(new Error('rejected'), { definitelyNotSent: true }); } } });
  await service.retryMessages();
  assert.equal((await store.read('pdv_outbox', 'a')).status, 'NEEDS_RECONCILIATION');
  const job = await store.read('pdv_outbox', 'b');
  assert.equal(job.status, 'PENDING'); assert.ok(job.nextAttemptAt > Date.now());
  await service.retryMessages(); assert.equal(sends, 1);
});

test('incoming failure removes old expiration and interrupted work is recoverable', async () => {
  const { base, db } = setup();
  const incoming = new IncomingMessageService(base);
  await incoming.accept({ messageId: 'one' });
  let claim = await incoming.claim('one');
  await incoming.finish(claim, new Error('offline'));
  assert.equal(db.data.get(`incoming_messages/${claim.id}`).expiresAt, null);
  await assert.rejects(incoming.claim('one'), /backoff/);
  db.data.get(`incoming_messages/${claim.id}`).nextAttemptAt = 0;
  claim = await incoming.claim('one');
  await incoming.finish(claim);
  assert.ok(db.data.get(`incoming_messages/${claim.id}`).compactAfter instanceof Date);
  assert.equal(db.data.get(`incoming_messages/${claim.id}`).expiresAt, null);
  assert.deepEqual(await incoming.claim('one'), { completed: true });
});

test('retention compacts only completed sends and preserves permanent deduplication', async () => {
  const now = Date.now();
  const old = { id: 'a', status: 'SENT', sentAt: new Date(now - 40 * 86400000).toISOString(), text: 'private', recipient: 'phone', orderId: 'order', providerMessageId: 'wamid.a' };
  const compact = compactOutboxRecord(old, { now, days: 30 });
  assert.equal(compact.text, undefined); assert.equal(compact.recipient, undefined);
  assert.equal(compact.orderId, 'order'); assert.equal(compact.providerMessageId, 'wamid.a');
  assert.equal(compactOutboxRecord(compact, { now }), null);
  for (const status of ['PENDING', 'SENDING', 'NEEDS_RECONCILIATION', 'SKIPPED']) assert.equal(compactOutboxRecord({ ...old, status }, { now }), null);
  const { store } = setup({ 'pdv_outbox/a': compact });
  assert.equal(await store.claimMessage('a'), null);
});

test('login, logout, expiration and role switching do not depend on physical TTL deletion', async () => {
  const { base, db } = setup();
  base.getUserById = async () => ({ id: 'usr-edmar', role: 'ADMIN', active: true });
  const sessions = createWebSessions(base);
  const headers = {};
  const req = { headers: { 'x-conflora-tab-session': '1' } };
  const res = { setHeader: (key, val) => { headers[key] = val; } };
  await sessions.issue(req, res, { id: 'usr-edmar' });
  req.headers.authorization = `Bearer ${headers['X-Conflora-Session']}`;
  await sessions.resolve(req, res, error => { if (error) throw error; });
  assert.equal(req.user.role, 'ADMIN');
  const path = [...db.data.keys()][0];
  db.data.get(path).expiresAt = new Date(0);
  delete req.user;
  await sessions.resolve(req, res, error => { if (error) throw error; });
  assert.equal(req.user, undefined);
  assert.equal((await sessions.setActiveRole(req, 'CAIXA')).success, false);
  await sessions.logout(req, res); assert.equal(db.data.size, 0);
});

test('rate limiting is shared across instances and rejected attempts do not write', async () => {
  const { base, db } = setup();
  const old = process.env.REQUEST_AUTH_LIMIT;
  process.env.REQUEST_AUTH_LIMIT = '2';
  try {
    const make = () => { const handlers = []; installRequestProtection({ use: (...args) => handlers.push(args.at(-1)) }, base); return handlers[1]; };
    const request = async middleware => {
      let status = 200;
      const res = { setHeader() {}, status(value) { status = value; return this; }, json() {} };
      await middleware({ path: '/auth/login', method: 'POST', ip: '127.0.0.1', body: { email: 'test@example.test' } }, res, () => {});
      return status;
    };
    const first = make(), second = make();
    assert.equal(await request(first), 200); assert.equal(await request(second), 200);
    const writes = db.metrics.writes;
    assert.equal(await request(first), 429); assert.equal(db.metrics.writes, writes);
    assert.ok([...db.data.values()].every(row => row.expiresAt instanceof Date));
  } finally { if (old === undefined) delete process.env.REQUEST_AUTH_LIMIT; else process.env.REQUEST_AUTH_LIMIT = old; }
});

test('GA4 flags require validation; failed reporting retains Firestore collection', async () => {
  const { base, db } = setup();
  let calls = 0;
  const report = async () => { calls++; throw new Error('no permission'); };
  const env = { ...gaEnv, GA4_REPORTS_VALIDATED: 'false' };
  const service = new StorefrontAnalyticsService(base, { env, report });
  await service.record({ id: randomUUID(), eventName: 'page_view' }); assert.equal(calls, 0);
  env.GA4_REPORTS_VALIDATED = 'true';
  await service.record({ id: randomUUID(), eventName: 'page_view' });
  assert.equal(db.metrics.writes, 2);
  await new StorefrontAnalyticsService(base, { env, report: ga4() }).record({ id: randomUUID(), eventName: 'page_view' });
  assert.equal(db.metrics.writes, 2);
});

test('GA4 requests are coalesced; cache expires and browser purchase reports cannot create revenue', async () => {
  const { base } = setup();
  let calls = 0, now = Date.now();
  base.firestore = null;
  const report = async body => { calls++; return ga4()(body); };
  const service = new StorefrontAnalyticsService(base, { env: gaEnv, now: () => now, report });
  await Promise.all(Array.from({ length: 20 }, () => service.navigation(30)));
  assert.equal(calls, 4);
  await service.navigation(30); assert.equal(calls, 4);
  now += 61000; await service.navigation(30); assert.equal(calls, 8);
  const date = new Date(now).toISOString();
  base.inMemoryOrders.set('unpaid', { id: 'unpaid', source: 'WEB_CATALOG', total: 999, status: 'PENDING', paymentStatus: 'PENDING', createdAt: date });
  base.inMemoryOrders.set('paid', { id: 'paid', source: 'WEB_CATALOG', total: 10, status: 'CONFIRMED', paymentStatus: 'APPROVED', paidAt: date, createdAt: date, paymentMethod: 'PIX' });
  await service.record({ id: 'fake', eventName: 'purchase', value: 99999 });
  const summary = await service.summary();
  assert.equal(summary.purchases, 1); assert.equal(summary.revenue, 10);
  assert.equal(summary.navigationSource, 'GA4');
});

test('legacy report cache reduces reads while financial results remain fresh', async () => {
  const { base } = setup();
  let reads = 0;
  base.firestore = null;
  base.getStorefrontAnalyticsSummary = async () => { reads++; return { visitors: 10, topProducts: [], campaigns: [], eventCounts: {} }; };
  const service = new StorefrontAnalyticsService(base, { env: {} });
  await Promise.all(Array.from({ length: 10 }, () => service.summary()));
  assert.equal(reads, 1);
  const now = new Date().toISOString();
  base.inMemoryOrders.set('new', { id: 'new', source: 'WEB_CATALOG', total: 22, status: 'CONFIRMED', paymentStatus: 'APPROVED', createdAt: now, paidAt: now, paymentMethod: 'DINHEIRO' });
  assert.equal((await service.summary()).revenue, 22); assert.equal(reads, 1);
});

test('event IDs deduplicate persistent writes and preserve original event date', async () => {
  const { base, db } = setup();
  const event = { id: randomUUID(), eventName: 'page_view' };
  await Promise.all([base.recordStorefrontEvent(event), base.recordStorefrontEvent(event)]);
  assert.equal(db.metrics.writes, 1);
});

test('frontend emits one explicit page_view; query PII and checkout purchase are blocked', () => {
  const source = readFileSync('public/storefront/app.js', 'utf8');
  const calls = [];
  const context = { existingStore: true, crypto: { randomUUID }, localStorage: { getItem: () => '', setItem() {} },
    location: { origin: 'https://example.test', search: '?email=alice@example.test&utm_source=alice@example.test&utm_campaign=5564999991234' },
    window: { gtag: (...args) => calls.push(args), ConfloraSession: { apiFetch: async () => ({}) } },
    state: {}, URLSearchParams, document: { createElement: () => ({}), head: { append() {} } } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('let analyticsVisitorId'), source.indexOf('const cashierShortcut')), context);
  vm.runInContext('trackStorefrontEvent("page_view"); trackStorefrontEvent("purchase", { orderId: "order-uuid", value: 10 });', context);
  assert.equal(calls.find(row => row[0] === 'config')[2].send_page_view, false);
  assert.equal(calls.filter(row => row[0] === 'event' && row[1] === 'page_view').length, 1);
  assert.equal(calls.filter(row => row[1] === 'purchase').length, 0);
  assert.ok(!JSON.stringify(calls).includes('alice@')); assert.ok(!JSON.stringify(calls).includes('5564999991234'));
  assert.equal(campaignLabel('email@example.test'), ''); assert.equal(campaignLabel('spring_sale'), 'spring_sale');
});

test('confirmed GA4 purchase exports only allowlisted fields; pending payment never exports', async () => {
  const env = { GA4_PURCHASE_EXPORT_ENABLED: 'true', GA4_REPORTS_VALIDATED: 'true', GA4_MEASUREMENT_ID: 'G-TEST123', GA4_API_SECRET: 'server-only' };
  const sent = [];
  const client = new Ga4PurchaseClient({ env, request: async (url, options) => { sent.push({ url, body: JSON.parse(options.body) }); return { ok: true }; } });
  const order = { id: randomUUID(), analyticsClientId: randomUUID(), source: 'WEB_CATALOG', paidAt: new Date().toISOString(), status: 'CONFIRMED', paymentStatus: 'APPROVED', total: 20,
    customerEmail: 'private@example.test', customerPhone: '55555555555', items: [{ productId: 'p', price: 10, quantity: 2 }] };
  await assert.rejects(client.send({ ...order, paymentStatus: 'PENDING' })); assert.equal(sent.length, 0);
  await client.send(order);
  assert.equal(sent[0].body.events[0].params.transaction_id, order.id);
  assert.ok(!JSON.stringify(sent[0].body).includes('private@'));
  assert.ok(!JSON.stringify(sent[0].body).includes('server-only'));
  assert.ok(!JSON.stringify(sent[0].body).includes('55555555555'));
});

test('a paid catalog order creates a single durable GA4 intent in the payment transaction', async () => {
  const saved = { ...process.env };
  Object.assign(process.env, { GA4_PURCHASE_EXPORT_ENABLED: 'true', GA4_REPORTS_VALIDATED: 'true', GA4_MEASUREMENT_ID: 'G-TEST123', GA4_API_SECRET: 'server-only' });
  try {
    const order = { id: 'web', source: 'WEB_CATALOG', analyticsClientId: randomUUID(), status: 'AWAITING_CASHIER', paymentStatus: 'PENDING', paymentMethod: 'DINHEIRO', total: 10,
      items: [{ productId: 'p', quantity: 1, price: 10 }], createdBy: { id: 'cashier', role: 'CAIXA' } };
    const { store, db } = setup({ 'orders/web': order, 'products/p': { stockQuantity: 20, price: 10 }, 'store_settings/inventory': { stockControlEnabled: true } });
    const receiver = { id: 'cashier', name: 'Teste', role: 'CAIXA' };
    await Promise.all([store.receive('web', receiver), store.receive('web', receiver)]);
    assert.equal(db.data.get('products/p').stockQuantity, 19);
    assert.equal(db.data.get('pdv_outbox/web-ga4-purchase').kind, 'ga4-purchase');
    assert.equal([...db.data.keys()].filter(key => key.endsWith('-ga4-purchase')).length, 1);
  } finally {
    for (const key of ['GA4_PURCHASE_EXPORT_ENABLED', 'GA4_REPORTS_VALIDATED', 'GA4_MEASUREMENT_ID', 'GA4_API_SECRET']) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
});
