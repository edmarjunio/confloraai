const { test, expect } = require('@playwright/test');

test('saved catalogue renders while API and login are still waiting, then updates silently', async ({ page }) => {
  await page.route(/https:\/\/.*/, route => route.abort());
  await page.goto('/');
  await expect(page.locator('#products .product-card').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.localStorage.getItem('conflora:public-catalog:v1:main%3Aconflora%3Av4')))).toBe(true);
  await page.evaluate(() => {
    const key = 'conflora:public-catalog:v1:main%3Aconflora%3Av4';
    const value = JSON.parse(localStorage.getItem(key));
    value.savedAt -= 61000;
    localStorage.setItem(key, JSON.stringify(value));
  });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/storefront/catalog', async route => {
    await gate;
    const response = await route.fetch();
    const data = await response.json();
    data.config.identity.name = 'Conflora atualizada';
    await route.fulfill({ json: data });
  });
  await page.route('**/api/auth/me', async route => {
    await gate;
    await route.fulfill({ status: 401, json: { user: null } });
  });
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#products .product-card').first()).toBeVisible();
    await expect(page.locator('#storeName')).not.toHaveText('Conflora atualizada');
  } finally {
    release();
  }
  await expect(page.locator('#storeName')).toHaveText('Conflora atualizada');
});

test('public shell and catalogue reopen offline without caching private APIs', async ({ page, context }) => {
  await page.goto('/shop/garden');
  await expect(page.locator('#products .product-card')).toHaveCount(2);
  await page.evaluate(() => window.navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => page.evaluate(() => Boolean(window.navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#products .product-card')).toHaveCount(2);
    const paths = await page.evaluate(async () => {
      const cacheName = (await window.caches.keys()).find(name => name.startsWith('conflora-public-shell-'));
      if (!cacheName) throw new Error('Cache público da loja não foi instalado.');
      const cache = await window.caches.open(cacheName);
      return (await cache.keys()).map(request => new URL(request.url).pathname);
    });
    expect(paths.some(path => /conflora-logo-[a-f0-9]{16}\.webp$/.test(path))).toBe(true);
    expect(paths.some(path => path.startsWith('/api/'))).toBe(false);
    expect(paths).not.toContain('/admin');
    expect(paths).not.toContain('/caixa');
  } finally {
    await context.setOffline(false);
  }
});

test('query cache deduplicates requests and invalidates only matching prefixes', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { QueryClient } = await import('/store-assets/query/tanstackQuery.js');
    const client = new QueryClient();
    let calls = 0;
    const query = { queryKey: ['catalog', 'garden'], queryFn: async () => ++calls };
    await Promise.all([client.fetchQuery(query), client.fetchQuery(query)]);
    const sharedCalls = calls;
    client.setQueryData(['config', 'garden'], { name: 'Keep' });
    client.invalidateQueries({ queryKey: ['catalog'] });
    await client.fetchQuery(query);
    return { sharedCalls, calls, config: client.getQueryData(['config', 'garden']) };
  });
  expect(result).toEqual({ sharedCalls: 1, calls: 2, config: { name: 'Keep' } });
});
