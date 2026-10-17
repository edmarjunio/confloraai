const { test, expect } = require('@playwright/test');

for (const width of [320, 390, 768, 1440]) {
  test(`catalogue recovers corrupted cart and fits a ${width}px screen`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/https:\/\/.*/, route => route.abort());
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      window.localStorage.setItem('store:garden:cart:v1', JSON.stringify([
        null, {}, { productId: 'product-1', quantity: 1 },
        { productId: 'product-1', quantity: 2 },
      ]));
    });
    await page.goto('/shop/garden');
    await expect(page.locator('#products .product-card')).toHaveCount(2);
    await expect(page.locator('#cartCount')).toHaveText('3');
    const dimensions = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/audit-catalogue-${width}.png` });
  });
}
