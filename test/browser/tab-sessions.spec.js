const { test, expect } = require('@playwright/test');

test('two tabs keep different logins, carts and customer fields after refresh and logout', async ({ context }) => {
  await context.route(/https:\/\/.*/, route => route.abort());
  const first = await context.newPage(); const second = await context.newPage();
  const login = async (page, userId, pin) => {
    await page.goto('/');
    await expect(page.locator('#products .product-card').first()).toBeVisible();
    await page.evaluate(async ({ userId, pin }) => {
      const response = await fetch('/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, pin }) });
      if (!response.ok) throw new Error('Login failed');
    }, { userId, pin });
    await page.reload();
  };
  const add = async (page, productId) => {
    if (await page.locator('#coachSkip').isVisible()) await page.locator('#coachSkip').click();
    await page.locator('#products .product-card').filter({ hasText: productId === 'test-begonia' ? 'Begônia' : 'Zamioculca' }).locator('[data-action=add]').last().click();
  };
  await login(first, 'usr-edmar', '1234');
  await expect(first.locator('#headerAccountRole')).toHaveText('ADMIN');
  await add(first, 'test-begonia');
  await first.locator('#cartButton').click();
  await first.locator('[name=name]').fill('Cliente exclusivo da primeira aba');
  await login(second, 'usr-caixa1', '0000');
  await expect(second.locator('#headerAccountRole')).toHaveText('CAIXA');
  await expect(second.locator('#cartCount')).toHaveText('0');
  await add(second, 'test-zamioculca');
  await second.locator('#cartButton').click();
  await expect(second.locator('#cartItems')).toContainText('Zamioculca');
  await expect(second.locator('#cartItems')).not.toContainText('Begônia');
  await expect(second.locator('[name=name]')).not.toHaveValue('Cliente exclusivo da primeira aba');
  await first.reload();
  await expect(first.locator('#headerAccountRole')).toHaveText('ADMIN');
  await first.locator('#cartButton').click();
  await expect(first.locator('#cartItems')).toContainText('Begônia');
  await expect(first.locator('#cartItems')).not.toContainText('Zamioculca');
  await second.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }));
  await first.reload();
  await expect(first.locator('#headerAccountRole')).toHaveText('ADMIN');
  await second.reload();
  await expect(second.locator('#accountButton')).toBeVisible();
  await expect(second.locator('#cartCount')).toHaveText('0');
  await login(second, 'usr-caixa1', '0000');
  await expect(second.locator('#headerAccountRole')).toHaveText('CAIXA');
  await second.locator('#cartButton').click();
  await expect(second.locator('#cartItems')).toContainText('Zamioculca');
  await expect(second.locator('#cartItems')).not.toContainText('Begônia');
  await expect(first.locator('#headerAccountRole')).toHaveText('ADMIN');
});

test('checkout exposes readable steps and no translation keys', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#products .product-card').first()).toBeVisible();
  await page.locator('#languageSelect').selectOption('pt');
  if (await page.locator('#coachSkip').isVisible()) await page.locator('#coachSkip').click();
  await page.locator('#cartButton').click();
  await expect(page.locator('#cartDialog')).toContainText('Confira seus produtos');
  await expect(page.locator('#pixBox')).not.toContainText('cart.pix_info');
  await expect(page.locator('#pixBox')).toContainText('confirmação depende');
  expect(await page.locator('#checkoutCustomer label').first().evaluate(node => Number.parseInt(window.getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(13);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('#cartDialog').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/checkout-readable-mobile.png' });
});
