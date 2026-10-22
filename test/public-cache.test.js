const test = require('node:test');
const assert = require('node:assert/strict');

test('public cache isolates shops, expires and persists only the public snapshot', async () => {
  const { createPublicCache } = await import('../public/storefront/public-cache.mjs');
  const entries = new Map();
  const storage = { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value) };
  let time = 1000;
  const main = createPublicCache('main:conflora', storage, () => time);
  const snapshot = { config: { identity: { name: 'Conflora' } }, products: [], user: { token: 'private' }, orders: [1] };
  main.write(snapshot);
  assert.deepEqual(main.read(), { config: snapshot.config, products: [] });
  assert.equal(createPublicCache('tenant:conflora', storage, () => time).read(), null);
  assert.ok(![...entries.values()][0].includes('private'));
  time += 24 * 60 * 60 * 1000 + 1;
  assert.equal(main.read(), null);
});

test('a fresh public snapshot avoids revalidation for one minute and can be selectively removed', async () => {
  const { createPublicCache } = await import('../public/storefront/public-cache.mjs');
  const entries = new Map();
  const storage = { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
  let now = 1000;
  const cache = createPublicCache('garden', storage, () => now);
  cache.write({ config: { identity: { name: 'Garden' } }, products: [] });
  assert.equal(cache.isFresh(), true);
  now += 60000;
  assert.equal(cache.isFresh(), false);
  assert.ok(cache.read()); // stale public content remains an offline fallback
  cache.invalidate();
  assert.equal(cache.read(), null);
});

test('public cache tolerates malformed or blocked browser storage', async () => {
  const { createPublicCache } = await import('../public/storefront/public-cache.mjs');
  const config = { identity: { name: 'Test' } };
  for (const raw of ['invalid', '{}', 'null', JSON.stringify({ savedAt: 2000, config, products: [] })]) {
    assert.equal(createPublicCache('test', { getItem: () => raw }, () => 1000).read(), null);
  }
  const denied = createPublicCache('test', {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('quota'); },
  });
  assert.equal(denied.read(), null);
  assert.doesNotThrow(() => denied.write({ config, products: [] }));
});
