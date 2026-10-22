const { test, expect } = require('@playwright/test');

test('customer purchases rank by quantity across pages; cashier hearts are absent from storefront', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'insights', name: 'Cliente', role: 'CLIENTE' } } }));
  await page.route('**/api/customer/orders**', route => route.fulfill({ json: route.request().url().includes('cursor=older')
    ? { orders: [{ id: 'older', status: 'CONFIRMED', createdAt: new Date().toISOString(), total: 50, items: [{ productId: 'test-zamioculca', quantity: 8 }] }], hasMore: false }
    : { orders: [{ id: 'recent', status: 'CONFIRMED', createdAt: new Date().toISOString(), total: 20, items: [{ productId: 'test-begonia', quantity: 2 }] }], hasMore: true, nextCursor: 'older' } }));
  await page.goto('/');
  await expect(page.locator('#customerAccountShortcut')).toBeVisible();
  await page.locator('#categoryFilterControl render-category-tag').filter({ hasText: 'Mais comprados' }).click();
  const products = page.locator('#products render-product-card');
  await expect(products).toHaveCount(2);
  await expect(products.first()).toContainText('Zamioculca');
  await expect(page.locator('#products [data-action="favorite"]')).toHaveCount(0);
  await page.locator('#customerAccountShortcut').click();
  await expect(page.locator('#historyList .spending-trends')).toContainText('Tendências de Gastos');
  await expect(page.locator('#historyList .recharts-wrapper')).toBeVisible();
  await page.locator('.spending-values summary').click();
  await expect(page.locator('.spending-values')).toContainText('70,00');
});

test('cart animates only increases and respects reduced motion', async ({ page }) => {
  await page.goto('/');
  const product = page.locator('#products render-product-card').filter({ hasText: 'Begônia' }).first();
  await expect(product).toBeVisible();
  await page.evaluate(() => {
    window.cartScales = [];
    const fab = document.querySelector('#cartFab');
    const animate = fab.animate.bind(fab);
    fab.animate = (...args) => { window.cartScales.push(args[0]); return animate(...args); };
  });
  await product.locator('[data-action="add"]').last().click();
  await expect.poll(() => page.evaluate(() => window.cartScales.length)).toBe(1);
  await page.locator('#cartFab').click();
  await expect(page.locator('.cart-drawer')).toBeVisible();
  await expect(page.locator('.cart-drawer')).toHaveCSS('animation-name', 'cart-drawer-slide-in');
  await page.locator('#cartClearButton').click();
  expect(await page.evaluate(() => window.cartScales.length)).toBe(1);
  await page.locator('#cartCloseButton').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await product.locator('[data-action="add"]').last().click();
  expect(await page.evaluate(() => window.cartScales.length)).toBe(1);
});
