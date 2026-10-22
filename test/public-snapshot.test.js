const test = require('node:test');
const assert = require('node:assert/strict');
const { createPublicSnapshot } = require('../src/storefront/public-snapshot');

test('public snapshot shares a burst, expires and does not cache failed reads', async () => {
  let reads = 0, now = 1, fail = false;
  const snapshot = createPublicSnapshot(async () => {
    reads++;
    if (fail) throw new Error('unavailable');
    return { products: [{ price: reads }] };
  }, { now: () => now });
  const values = await Promise.all(Array.from({ length: 100 }, () => snapshot.read()));
  assert.equal(reads, 1);
  assert.ok(values.every(value => value === values[0]));
  await snapshot.read(); assert.equal(reads, 1);
  now += 15000; await snapshot.read(); assert.equal(reads, 2);
  snapshot.invalidate(); fail = true;
  await assert.rejects(snapshot.read(), /unavailable/);
  fail = false; await snapshot.read(); assert.equal(reads, 4);
  assert.equal(snapshot.metrics.shared, 99);
});

test('an edit during a pending read cannot republish an obsolete price', async () => {
  let release, reads = 0;
  const snapshot = createPublicSnapshot(async () => {
    reads++;
    if (reads === 1) return new Promise(resolve => { release = resolve; });
    return { price: 20 };
  });
  const pending = snapshot.read();
  await Promise.resolve();
  snapshot.invalidate();
  release({ price: 10 });
  assert.deepEqual(await pending, { price: 20 });
  assert.deepEqual(await snapshot.read(), { price: 20 });
  assert.equal(reads, 2);
});
