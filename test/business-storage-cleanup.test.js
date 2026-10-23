const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = () => import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync('public/storefront/storage-cleanup.js')).toString('base64'));

test('startup removes every legacy business snapshot and cart without removing language preference', async () => {
  const values = new Map([['conflora_catalog_cache', 'stale'], ['conflora:public-catalog:v1:main:conflora', 'stale'],
    ['conflora_cart_items_v2', 'stale'], ['conflora_customer_info_v2', 'stale'], ['store:shop:cart:v1', 'stale'], ['conflora_lang', 'pt']]);
  const storage = { get length() { return values.size; }, key: index => [...values.keys()][index], removeItem: key => values.delete(key) };
  (await load()).clearLegacyBusinessStorage(storage);
  assert.deepEqual([...values.keys()], ['conflora_lang']);
});

test('blocked browser storage cannot break startup', async () => {
  const storage = { get length() { throw new Error('Storage disabled'); } };
  assert.doesNotThrow(() => (load()).then(module => module.clearLegacyBusinessStorage(storage)));
  (await load()).clearLegacyBusinessStorage(storage);
});

test('startup removes old Conflora caches while preserving other applications', async () => {
  const names = new Set(['conflora-public-shell-old', 'conflora-catalog-old', 'other-application']);
  await (await load()).clearLegacyBusinessCaches({ keys: async () => [...names], delete: async key => names.delete(key) });
  assert.deepEqual([...names], ['other-application']);
});
