const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdirSync, writeFileSync } = require('node:fs');
const { meteredFirestore } = require('./helpers/metered-firestore');
const { FirestoreRepository } = require('./helpers/repository-fixture');
const { normalizeExistingCheckout } = require('../src/storefront/existing-store');
const { StorefrontAnalyticsService } = require('../src/services/storefront-analytics.service');
const { IncomingMessageService } = require('../src/services/incoming-message.service');
const { compactIncomingRecord } = require('../src/database/retention');

async function batches(count, size, work) {
  for (let offset = 0; offset < count; offset += size) await Promise.all(Array.from({ length: Math.min(size, count - offset) }, (_, i) => work(offset + i)));
}
const stats = db => ({ reads: db.metrics.reads, writes: db.metrics.writes, deletes: db.metrics.deletes, queries: db.metrics.queries,
  measuredQueryMs: Number(db.metrics.queryMs.reduce((a, b) => a + b, 0).toFixed(2)) });
async function webCheckouts(count, fullScan) {
  const db = meteredFirestore(Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`products/p${i}`, { id: `p${i}`, name: `Produto ${i}`, price: 10, unit: 'UN', stockQuantity: 10000, status: 'ATIVO' }])));
  const repo = new FirestoreRepository({ firestoreInstance: db, isInMemory: true });
  if (!db.data.has('store_settings/storefront')) db.data.set('store_settings/storefront', repo.storefrontSettings);
  repo.getAllProducts = async () => (await db.collection('products').get()).docs.map(doc => ({ ...doc.data(), id: doc.id }));
  if (fullScan) repo.getProductsByIds = undefined;
  const started = performance.now();
  await batches(count, 20, async () => {
    const req = { path: '/api/storefront/orders', body: { customer: { name: 'Teste isolado', phone: '64999999999' }, fulfillment: 'pickup', paymentMethod: 'PIX', items: [0, 1, 2].map(i => ({ productId: `p${i}`, quantity: 1 })) } };
    await normalizeExistingCheckout(req, repo); assert.equal(req.body.subtotal, 30);
  });
  return { ...stats(db), durationMs: Math.round(performance.now() - started) };
}

test('incremental FinOps load: web checkouts, navigation/search and WhatsApp at 100/500/1000 sales equivalents', async () => {
  const report = {
    environment: 'INSTRUMENTED_MOCK_NOT_CLOUD_BILLING',
    assumptions: { products: 1000, itemsPerCheckout: 3, concurrent: 20, webCheckoutShare: 1, visitsPerSale: 5, navigationEventsPerVisit: 6, whatsappMessagesPerSale: 2 },
    baseline: 'Previous full-scan checkout reconstructed through existing compatibility path; financial writes excluded from this incremental measurement',
    scenarios: [],
  };
  for (const salesPerDay of [100, 500, 1000]) {
    const before = await webCheckouts(salesPerDay, true), after = await webCheckouts(salesPerDay, false);
    assert.equal(before.reads - after.reads, 997 * salesPerDay);
    assert.equal(after.writes, 0);
    const db = meteredFirestore();
    const repo = new FirestoreRepository({ firestoreInstance: db, isInMemory: true });
  if (!db.data.has('store_settings/storefront')) db.data.set('store_settings/storefront', repo.storefrontSettings);
    const eventCount = salesPerDay * 5 * 6;
    const legacy = new StorefrontAnalyticsService(repo, { env: {} });
    await batches(eventCount, 50, () => legacy.record({ id: randomUUID(), eventName: 'view_item', productId: 'p0' }));
    const beforeWrites = db.metrics.writes;
    const ga4 = new StorefrontAnalyticsService(repo, { env: { GA4_PROPERTY_ID: '123', GA4_REPORTS_VALIDATED: 'true', STOREFRONT_ANALYTICS_MODE: 'ga4' }, report: async () => ({ rows: [] }) });
    await batches(eventCount, 50, () => ga4.record({ id: randomUUID(), eventName: 'search', searchLength: 10, resultCount: 2 }));
    const ga4Writes = db.metrics.writes - beforeWrites;
    assert.equal(ga4Writes, 0);
    const inbox = new IncomingMessageService(repo);
    await batches(salesPerDay * 2, 20, async i => {
      const messageId = `wamid.isolated-${i}`;
      await inbox.accept({ messageId, phone: `5564${String(i).padStart(9, '0')}`, message: 'consulta de produto de teste' });
      const claim = await inbox.claim(messageId); await inbox.finish(claim);
      assert.equal((await inbox.claim(messageId)).completed, true);
    });
    const rows = [...db.data.values()].filter(row => row.status === 'COMPLETED');
    const compacted = rows.map(row => compactIncomingRecord(row, { now: Date.now() + 40 * 86400000 }));
    assert.ok(compacted.every(row => row && row.expiresAt === null && row.payload === undefined));
    const savedReads = before.reads - after.reads;
    report.scenarios.push({ salesPerDay, webCheckout: { before, after, savedReads }, navigation: { events: eventCount, beforeWrites, ga4Writes, requiresValidatedMigration: true },
      whatsapp: { messages: rows.length, payloadJsonBytesBefore: Buffer.byteLength(JSON.stringify(rows)), tombstoneJsonBytesAfter: Buffer.byteLength(JSON.stringify(compacted)) },
      monthly30Days: { savedReads: savedReads * 30, savedNavigationWrites: beforeWrites * 30,
        costFormula: `${savedReads * 30 / 100000} * readRatePer100k + ${beforeWrites * 30 / 100000} * writeRatePer100k`,
        excludes: ['free quotas', 'TTL delete charges', 'indexes', 'network', 'storage overhead', 'regional tariffs', 'GA4 quotas'] } });
  }
  mkdirSync('tmp', { recursive: true });
  writeFileSync('tmp/firestore-finops-incremental-results.json', JSON.stringify(report, null, 2));
});
