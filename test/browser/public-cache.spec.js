const { test, expect } = require('@playwright/test');

test('legacy catalogue is discarded while the new public cache renders during revalidation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#products .product-card').first()).toBeVisible();
  await page.evaluate(() => localStorage.setItem('conflora:public-catalog:v1:main%3Aconflora%3Av4', JSON.stringify({ savedAt: Date.now(), products: [{ id: 'old', name: 'Produto antigo' }] })));
  await expect.poll(() => page.evaluate(async () => {
    const { createPublicCatalog } = await import('/store-assets/public-catalog.mjs');
    return Boolean(await createPublicCatalog('main:conflora').read());
  })).toBe(true);
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = window.indexedDB.open('cf-public-20261023-reset1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('catalog', 'readwrite');
      const store = tx.objectStore('catalog');
      const read = store.get('main:conflora');
      read.onsuccess = () => store.put({ ...read.result, savedAt: Date.now() - 61000 }, 'main:conflora');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/storefront/catalog', async route => {
    await gate;
    const response = await route.fetch();
    const data = await response.json();
    data.config.identity.name = 'Conflora atualizada';
    await route.fulfill({ json: data });
  });
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => localStorage.getItem('conflora:public-catalog:v1:main%3Aconflora%3Av4'))).toBeNull();
    await expect(page.locator('#products .product-card').first()).toBeVisible();
    await expect(page.locator('#catalogSyncStatus')).toContainText('Atualizando');
    await expect(page.locator('body')).not.toContainText('Produto antigo');
  } finally { release(); }
  await expect(page.locator('#storeName')).toHaveText('Conflora atualizada');
  await expect(page.locator('#products .product-card').first()).toBeVisible();
});

test('startup purges legacy Cache Storage independently of the new public IndexedDB', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await window.caches.open('conflora-public-shell-obsolete');
  });
  await page.reload();
  await expect.poll(() => page.evaluate(async () => (await window.caches.keys()).filter(name => name.startsWith('conflora')))).toEqual([]);
});

test('public persistence rejects obsolete writes after invalidation', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { createPublicCatalog } = await import('/store-assets/public-catalog.mjs');
    const cache = createPublicCatalog('isolated-browser-test');
    const revision = cache.revision();
    cache.invalidate();
    cache.write({ config: { identity: { name: 'Obsolete' } }, products: [] }, revision);
    return cache.read();
  });
  expect(result).toBeNull();
});

test('reset deletes the retired database and preserves the current cache on later visits', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#products .product-card').first()).toBeVisible();
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = window.indexedDB.open('cf-public-20261023', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('catalog');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('catalog', 'readwrite');
      tx.objectStore('catalog').put({ products: [{ name: 'Retired sentinel' }] }, 'main:conflora');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }));
  await page.reload();
  await expect.poll(() => page.evaluate(async () => (await window.indexedDB.databases()).some(db => db.name === 'cf-public-20261023'))).toBe(false);
  await expect.poll(() => page.evaluate(async () => {
    const { createPublicCatalog } = await import('/store-assets/public-catalog.mjs');
    return Boolean(await createPublicCatalog('main:conflora').read());
  })).toBe(true);
  await expect(page.locator('body')).not.toContainText('Retired sentinel');
});
