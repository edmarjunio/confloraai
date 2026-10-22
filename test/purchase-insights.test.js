const { test } = require('node:test');
const assert = require('node:assert/strict');
const modulePromise = import('../public/storefront/purchase-insights.mjs');

test('six calendar months include zeros, exclude cancellations and deduplicate purchases', async () => {
  const { summarizePurchases } = await modulePromise;
  const purchase = { id: 'one', createdAt: '2026-10-01T02:00:00Z', total: 12.34, status: 'CONFIRMED', items: [{ productId: 'a', quantity: 2 }] };
  const result = summarizePurchases([
    purchase, purchase,
    { id: 'two', createdAt: '2026-10-10T12:00:00Z', totalMinor: 500, paymentStatus: 'ON_ACCOUNT', items: [{ productId: 'b', quantity: 0.5 }] },
    { ...purchase, id: 'cancel', status: 'CANCELLED', paidAt: '2026-10-01' },
    { ...purchase, id: 'pending', status: 'AWAITING_PAYMENT' },
    { ...purchase, id: 'old', createdAt: '2025-01-01' },
  ], new Date('2026-10-21T12:00:00Z'));
  assert.deepEqual(result.months.map(m => m.key), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  assert.deepEqual(result.months.map(m => m.amountMinor), [0, 0, 0, 0, 1234, 500]);
  assert.equal(result.quantities.get('a'), 4);
  assert.equal(result.quantities.get('b'), 0.5);
});

test('insights load all history pages once and reject stale account responses', async () => {
  const { createPurchaseInsights } = await modulePromise;
  const requests = [];
  const state = { existingStore: true, user: { id: 'one' }, api: async path => {
    requests.push(path);
    return path.includes('cursor=next')
      ? { orders: [{ id: 'old', status: 'CONFIRMED', items: [{ productId: 'a', quantity: 10 }] }], hasMore: false }
      : { orders: [{ id: 'new', status: 'CONFIRMED', items: [{ productId: 'a', quantity: 1 }] }], hasMore: true, nextCursor: 'next' };
  } };
  const insights = createPurchaseInsights(state);
  const [first, second] = await Promise.all([insights.load(), insights.load()]);
  assert.equal(first.quantities.get('a'), 11);
  assert.equal(second, first);
  assert.equal(requests.length, 2);
  let finish;
  state.api = () => new Promise(resolve => { finish = resolve; });
  insights.invalidate();
  const pending = insights.load();
  state.user = { id: 'two' };
  finish({ orders: [], hasMore: false });
  await assert.rejects(pending, /Conta alterada/);
});

test('legacy purchase names resolve only to one product and confirmed legacy statuses count', async () => {
  const { summarizePurchases } = await modulePromise;
  const result = summarizePurchases([{ id: 'legacy', status: 'CONFIRMED_AWAITING_DELIVERY', items: [
    { name: 'BEGONIA', quantity: 3 }, { name: 'Muda', quantity: 50 }, null,
  ] }], new Date(), [
    { id: 'begonia', name: 'Begônia' }, { id: 'muda-a', name: 'Muda' }, { id: 'muda-b', name: 'Muda' },
  ]);
  assert.deepEqual([...result.quantities], [['begonia', 3]]);
});
