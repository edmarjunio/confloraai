const test = require('node:test');
const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const { meteredFirestore } = require('./helpers/metered-firestore');
const { FirestoreRepository } = require('./helpers/repository-fixture');
const { PdvRepository } = require('../src/orders/pdv.repository');

test('shared commercial core: 100/500/1000 sales, 20 concurrent requests, replay and payment', async () => {
  const report = { environment: 'SERIAL_TRANSACTION_MOCK_NOT_FIRESTORE_BENCHMARK',
    assumptions: { productsInCatalog: 1000, itemsPerSale: 3, concurrentRequests: 20, replaysPerSale: 1 }, scenarios: [] };
  for (const count of [100, 500, 1000]) {
    const db = meteredFirestore(Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`products/p${i}`, {
      id: `p${i}`, name: `Produto ${i}`, price: 8.99, unit: 'KG', stockQuantity: 10000, status: 'ATIVO',
    }])));
    const repo = new FirestoreRepository({ firestoreInstance: db, isInMemory: true });
    require('./helpers/open-cashier-fixture').seedOpenCashier(repo, { id: 'cashier' });
    const store = new PdvRepository(repo); const timings = [];
    const started = performance.now();
    for (let offset = 0; offset < count; offset += 20) await Promise.all(Array.from({ length: Math.min(20, count - offset) }, async (_, n) => {
      const i = offset + n, id = `load-${i}`, source = ['PDV', 'WEB_CATALOG', 'WHATSAPP_BOT'][i % 3];
      const start = performance.now();
      const order = await repo.createDirectOrder({ id, source, customerPhone: '5564999990000', customerName: 'Cliente isolado', paymentMethod: 'DINHEIRO', total: 5.4, status: 'AWAITING_PAYMENT',
        items: [0, 1, 2].map(p => ({ productId: `p${p}`, name: `Produto ${p}`, price: 8.99, quantity: 0.2, unit: 'KG' })) }, { reserveInventory: true });
      await repo.createDirectOrder(order, { reserveInventory: true });
      await store.receive(id, { id: 'cashier', name: 'Caixa isolado', role: 'CAIXA' }, null, 10);
      timings.push(performance.now() - start);
    }));
    assert.equal([...db.data.keys()].filter(path => path.startsWith('orders/')).length, count);
    assert.equal([...db.data.keys()].filter(path => path.startsWith('stock_movements/')).length, count * 3);
    assert.equal(db.data.get('products/p0').stockQuantity, Number((10000 - count * 0.2).toFixed(3)));
    assert.equal(db.data.get('products/p0').reservedQuantity, 0);
    timings.sort((a, b) => a - b);
    report.scenarios.push({ salesEquivalent: count, durationMs: Math.round(performance.now() - started),
      p95ServiceMs: Number(timings[Math.ceil(timings.length * 0.95) - 1].toFixed(2)),
      documentReads: db.metrics.reads, documentWrites: db.metrics.writes, transactions: db.metrics.transactions,
      note: 'Local simulated operations, excludes SDK retries, regional latency, indexes, quotas and provider traffic' });
  }
  writeFileSync('tmp/commercial-load-results.json', JSON.stringify(report, null, 2));
});
