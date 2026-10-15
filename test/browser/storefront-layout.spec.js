const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const original = execFileSync('git', ['show', '0722bc3:public/storefront/index.html'], { encoding: 'utf8' });

for (const width of [1440, 390]) {
  test(`restores original storefront geometry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const intercept = route => route.fulfill({ contentType: 'text/html', body: original });
    await page.route('http://127.0.0.1:8099/', intercept);
    await page.goto('/');
    await expect(page.locator('#products .product-card').first()).toBeVisible();
    if (await page.locator('#coachSkip').isVisible()) await page.locator('#coachSkip').click();
    const before = await page.locator('#products .product-card').first().boundingBox();
    await page.screenshot({ path: `test-results/storefront-before-${width}.png` });
    await page.unroute('http://127.0.0.1:8099/', intercept);
    await page.goto('/');
    await expect(page.locator('#products .product-card').first()).toBeVisible();
    const after = await page.locator('#products .product-card').first().boundingBox();
    await page.screenshot({ path: `test-results/storefront-restored-${width}.png` });
    expect(Math.abs(before.width - after.width)).toBeLessThan(2);
    expect(Math.abs(before.x - after.x)).toBeLessThan(2);
    // Header actions now have 44px touch targets as requested.
    expect(Math.abs(before.y - after.y)).toBeLessThan(30);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width < 768) await expect(page.locator('#mobileBottomBar')).toBeVisible();
    await page.locator('.favorite').first().click();
    await expect(page.locator('.favorite').first()).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#products .primary').first().click();
    await page.locator('#cartButton').click();
    await expect(page.locator('dialog.cart-drawer')).toBeVisible();
    const drawer = await page.locator('dialog.cart-drawer').boundingBox();
    expect(drawer.x + drawer.width).toBeLessThanOrEqual(width + 1);
    await page.locator('dialog.cart-drawer .dialog-header button').click();
    await page.locator('#products .product-name').first().click();
    await expect(page.locator('.detail-grid')).toBeVisible();
    const photo = await page.locator('.detail-gallery').boundingBox();
    const copy = await page.locator('.detail-copy').boundingBox();
    if (width >= 768) expect(copy.x).toBeGreaterThan(photo.x + photo.width);
    else expect(copy.y).toBeGreaterThan(photo.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/product-restored-${width}.png` });
  });
}
