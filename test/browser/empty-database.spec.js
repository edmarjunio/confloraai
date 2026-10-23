const { test, expect } = require('@playwright/test');

test('every main screen works with no business records and no cached catalogue', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('conflora_catalog_cache', JSON.stringify([{ id: 'old-product', name: 'Produto antigo' }])));
  await page.reload();
  await expect(page.locator('body')).not.toContainText('Produto antigo');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('conflora_catalog_cache'))).toBeNull();
  const catalogue = await (await page.request.get('/api/storefront/catalog')).json();
  expect(catalogue.products).toEqual([]);
  const operators = await (await page.request.get('/api/admin/auth/users')).json();
  expect(operators.users || operators).toEqual([]);
  await page.goto('/pdv');
  await expect(page.getByLabel('Usuário')).toBeVisible();
  await page.evaluate(async () => {
    const response = await window.ConfloraSession.apiFetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'isolated-empty-owner' }) });
    if (!response.ok) throw new Error('Isolated authentication failed');
  });
  for (const path of ['/pdv', '/admin', '/admin-gerencial', '/configuracoes', '/?conta=1', '/privacy', '/terms', '/data-deletion']) {
    await page.goto(path);
    await expect(page.locator('body')).toBeVisible();
    await expect.poll(() => page.locator('body').innerText()).not.toBe('');
    await expect(page.locator('body')).not.toContainText('Planta Teste');
  }
  for (const tab of ['cashier', 'orders', 'stock', 'products', 'team', 'status', 'analytics', 'price', 'notifs']) {
    await page.goto('/admin?tab=' + tab);
    await expect(page.locator('#tab-' + tab)).toHaveClass(/active/);
    await expect(page.locator('body')).not.toContainText('Planta Teste');
  }
  await page.goto('/admin?tab=products');
  await expect(page.locator('#adminProductsGrid render-product-card')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/empty-admin.png', fullPage: true });
  await page.goto('/pdv');
  await expect(page.locator('.cashier-command-nav')).toBeVisible();
  await expect(page.locator('render-product-card')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('.cashier-command-nav')).toBeVisible();
  await page.screenshot({ path: 'test-results/empty-cashier-mobile.png' });
  expect(errors).toEqual([]);
});
