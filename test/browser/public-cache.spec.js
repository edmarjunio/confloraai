const { test, expect } = require('@playwright/test');

test('legacy catalogue is discarded and products wait for the current backend response', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#products .product-card').first()).toBeVisible();
  await page.evaluate(() => localStorage.setItem('conflora:public-catalog:v1:main%3Aconflora%3Av4', JSON.stringify({ savedAt: Date.now(), products: [{ id: 'old', name: 'Produto antigo' }] })));
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
    await expect(page.locator('#products .product-card')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Produto antigo');
  } finally { release(); }
  await expect(page.locator('#storeName')).toHaveText('Conflora atualizada');
  await expect(page.locator('#products .product-card').first()).toBeVisible();
});

test('startup purges old business caches without installing offline catalogue storage', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await window.caches.open('conflora-public-shell-obsolete');
  });
  await page.reload();
  await expect.poll(() => page.evaluate(async () => (await window.caches.keys()).filter(name => name.startsWith('conflora')))).toEqual([]);
});

test('simultaneous queries share one request and the next read always fetches current data', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { QueryClient } = await import('/store-assets/query/tanstackQuery.js');
    const client = new QueryClient();
    let calls = 0;
    const query = { queryKey: ['catalog', 'garden'], queryFn: async () => ++calls };
    await Promise.all([client.fetchQuery(query), client.fetchQuery(query)]);
    const sharedCalls = calls;
    await client.fetchQuery(query);
    return { sharedCalls, calls };
  });
  expect(result).toEqual({ sharedCalls: 1, calls: 2 });
});
