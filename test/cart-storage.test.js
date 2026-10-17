const test = require('node:test');
const assert = require('node:assert/strict');

test('cart storage recovers valid items from corrupted browser data', async () => {
  const { normalizeStoredCart } = await import('../public/storefront/cart-storage.mjs');
  for (const value of [null, {}, 'invalid', 42]) {
    assert.deepEqual(normalizeStoredCart(value), []);
  }
  assert.deepEqual(normalizeStoredCart([
    null, false, {}, { productId: '  ', quantity: 1 },
    { productId: 'plant', quantity: -1 },
    { productId: 'plant', quantity: '2' },
    { productId: 'plant', quantity: NaN },
    { productId: 'plant', quantity: Infinity },
    { productId: 'plant', quantity: 2, price: 0.01 },
    { productId: 'fruit', quantity: 0.5 },
    { productId: 'plant', quantity: 3 },
  ]), [{ productId: 'plant', quantity: 5 }, { productId: 'fruit', quantity: 0.5 }]);
});

test('cart storage does not mutate persisted rows or overflow duplicate quantities', async () => {
  const { normalizeStoredCart } = await import('../public/storefront/cart-storage.mjs');
  const row = Object.freeze({ productId: 'plant', quantity: Number.MAX_VALUE });
  assert.deepEqual(normalizeStoredCart(Object.freeze([row, row])), [row]);
});
