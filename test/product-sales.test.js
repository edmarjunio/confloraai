const test = require('node:test');
const assert = require('node:assert/strict');
const { rankProductSales } = require('../src/catalog/product-sales');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const vm = require('node:vm');
const { renderHomeHtml } = require('../src/http/views-home');

test('rendered catalog classic scripts have valid JavaScript syntax', () => {
  for (const match of renderHomeHtml().matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (match[1].includes('type="module"')) { continue; }
    assert.doesNotThrow(() => new vm.Script(match[2]));
  }
});

test('sales counts include confirmed units and exclude pending, cancelled and invalid items', () => {
  const products = [{ id: 'a', name: 'Árvore' }, { id: 'b', name: 'Muda' }];
  const orders = [
    { status: 'CONFIRMED', items: [{ productId: 'a', quantity: 3 }] },
    { status: 'DELIVERED', items: [{ name: 'arvore', quantity: 2 }] },
    { status: 'PAID_CONFIRMED', items: [{ id: 'b', quantity: '4' }] },
    ...['PENDING', 'CANCELLED', 'AWAITING_CONFIRMATION'].map(status => ({
      status, items: [{ productId: 'a', quantity: 100 }],
    })),
    { status: 'CONFIRMED', items: [null, { productId: 'a', quantity: -1 },
      { productId: 'a', quantity: 'invalid' }, { productId: 'missing', name: 'Muda', quantity: 9 }] },
  ];
  assert.deepEqual(rankProductSales(products, orders).map(p => p.salesCount), [5, 4]);
  assert.equal(products[0].salesCount, undefined);
});

test('legacy names never assign sales to ambiguous products', () => {
  const products = [{ id: 'a', name: 'Muda' }, { id: 'b', name: 'Muda' }];
  const orders = [{ status: 'CONFIRMED', items: [{ name: 'Muda', quantity: 8 }] }];
  assert.deepEqual(rankProductSales(products, orders).map(p => p.salesCount), [0, 0]);
});

test('sales history is not truncated to the latest 50 orders', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });
  for (let i = 0; i < 75; i++) {
    repo.inMemoryOrders.set(String(i), { status: 'CONFIRMED', items: [{ id: 'a', quantity: 1 }] });
  }
  const products = rankProductSales([{ id: 'a', name: 'Muda' }], await repo.getSalesOrders());
  assert.equal(products[0].salesCount, 75);
});
