const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { writeFileSync, mkdirSync } = require('node:fs');
const { meteredFirestore } = require('./helpers/metered-firestore');
const { FirestoreRepository } = require('./helpers/repository-fixture');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { PdvService } = require('../src/orders/pdv.service');
const { CatalogRepository } = require('./helpers/catalog-fixture');
const { IncomingMessageService } = require('../src/services/incoming-message.service');
const { StorefrontAnalyticsService } = require('../src/services/storefront-analytics.service');

async function concurrent(items, size, work) {
  for (let offset = 0; offset < items.length; offset += size) await Promise.all(items.slice(offset, offset + size).map(work));
}
const fixture = (count = 1000) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`products/p${i}`, { id: `p${i}`, name: `Produto ${i}`, price: 10, stockQuantity: 10000, status: 'ATIVO', unit: 'UN' }]));
async function sales(count, legacyCatalogRead) {
  const db = meteredFirestore({ ...fixture(), 'store_settings/inventory': { stockControlEnabled: true } });
  const base = new FirestoreRepository({ firestoreInstance: db, isInMemory: true });
  if (legacyCatalogRead) base.getProductsByIds = async () => (await db.collection('products').get()).docs.map(doc => ({ ...doc.data(), id: doc.id }));
  const store = new PdvRepository(base);
  let sends = 0;
  const service = new PdvService({ repository: store, ownerPhone: '5564999990000', whatsapp: {
    sendTextMessage: async () => ({ messages: [{ id: `wamid.mock.${++sends}` }] }),
  } });
  const actor = { id: 'cashier', name: 'Teste isolado', role: 'CAIXA' };
  require('./helpers/open-cashier-fixture').seedOpenCashier(base, actor);
  const start = performance.now();
  const orders = [];
  await concurrent(Array.from({ length: count }), 20, async () => {
    const order = await service.create({ requestId: randomUUID(), paymentMethod: 'DINHEIRO', customerPhone: '5564999990001', items: [0, 1, 2].map(i => ({ productId: `p${i}`, quantity: 1 })) }, actor);
    orders.push(order);
    assert.equal(order.paymentStatus, 'APPROVED');
  });
  for (const order of orders.slice(0, 20)) await store.receive(order.id, actor); // Repeated confirmation cannot debit twice.
  assert.equal(db.data.get('products/p0').stockQuantity, 10000 - count);
  assert.equal([...db.data.keys()].filter(key => key.startsWith('stock_movements/')).length, count * 3);
  return { durationMs: Math.round(performance.now() - start), sends, ...db.metrics, queryMs: undefined };
}

test('isolated load: 100, 500 and 1000 sales, 20 concurrent checkouts, catalog and WhatsApp', async () => {
  const report = { environment: 'INSTRUMENTED_SERIAL_TRANSACTION_MOCK', catalogProducts: 1000, itemsPerSale: 3, concurrent: 20, scenarios: [] };
  for (const count of [100, 500, 1000]) {
    const before = await sales(count, true);
    const after = await sales(count, false);
    assert.equal(before.reads - after.reads, count * 997);
    assert.equal(before.writes, after.writes);
    report.scenarios.push({ salesPerDay: count, before, after, savedReads: before.reads - after.reads });
  }

  const db = meteredFirestore(fixture());
  const base = new FirestoreRepository({ firestoreInstance: db, isInMemory: true });
  base.getAllProducts = async () => (await db.collection('products').get()).docs.map(doc => ({ ...doc.data(), id: doc.id }));
  const catalog = new CatalogRepository({ firestoreRepo: base });
  await Promise.all(Array.from({ length: 100 }, () => catalog.refreshCatalog()));
  assert.equal(db.metrics.reads, 1000);
  report.concurrentCatalogRefresh = { accesses: 100, reads: db.metrics.reads, note: 'Existing cache retained, no new optimization claimed' };

  const analytics = new StorefrontAnalyticsService(base, { env: {} });
  const eventsBefore = db.metrics.writes;
  await concurrent(Array.from({ length: 1000 }), 50, async () => analytics.record({ id: randomUUID(), visitorId: randomUUID(), eventName: 'view_item', productId: 'p0' }));
  report.navigationFallbackWrites = db.metrics.writes - eventsBefore;
  const primary = new StorefrontAnalyticsService(base, { env: { GA4_PROPERTY_ID: '123', GA4_REPORTS_VALIDATED: 'true', STOREFRONT_ANALYTICS_MODE: 'ga4' }, report: async () => ({ rows: [] }) });
  const primaryBefore = db.metrics.writes;
  await Promise.all(Array.from({ length: 1000 }, () => primary.record({ id: randomUUID(), eventName: 'view_item' })));
  report.navigationGa4Writes = db.metrics.writes - primaryBefore;
  assert.equal(report.navigationGa4Writes, 0);

  const incoming = new IncomingMessageService(base);
  await concurrent(Array.from({ length: 100 }, (_, i) => i), 20, async i => {
    const id = `mock-incoming-${i}`;
    await incoming.accept({ messageId: id, phone: `5564${String(i).padStart(9, '0')}`, message: 'produto' });
    const claim = await incoming.claim(id);
    await incoming.finish(claim);
    assert.equal((await incoming.claim(id)).completed, true);
  });
  report.whatsappInbound = { messages: 100, completed: [...db.data.entries()].filter(([key, value]) => key.startsWith('incoming_messages/') && value.status === 'COMPLETED').length };
  mkdirSync('tmp', { recursive: true });
  writeFileSync('tmp/firestore-load-results.json', JSON.stringify(report, null, 2));
});
