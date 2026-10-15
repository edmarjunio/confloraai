const { test, expect } = require('@playwright/test');
const labels = require('../../src/web/i18n/locales/pt-BR.json');

async function assertHeader(page) {
  const cart = page.locator('#cartButton');
  const menu = page.getByRole('button', { name: 'Equipe', exact: true });
  await expect(cart).toBeVisible();
  await expect(menu).toBeVisible();
  await expect(cart.locator('svg')).toHaveCount(1);
  await expect(menu.locator('svg')).toHaveCount(1);
  await expect(menu).toHaveText('');
  await expect(cart).toHaveText(/^\d+$/);
  const left = await cart.boundingBox();
  const right = await menu.boundingBox();
  expect(right.x).toBeGreaterThanOrEqual(left.x + left.width);
  expect(Math.abs(left.y - right.y)).toBeLessThan(2);
  expect(left.width).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const width of [1440, 390]) {
  test(`shared catalogue layout across pages and every admin tab at ${width}px`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/conta', '/privacy', '/terms', '/data-deletion', '/simulador', '/shop/garden/configuracoes']) {
      await page.goto(route);
      await assertHeader(page);
      await expect(page.locator('link[href="/store-assets/v5/store.css"]')).toHaveCount(1);
    }
    await page.goto('/pdv');
    const users = await (await page.request.get('/api/admin/auth/users')).json();
    const admin = users.find(user => user.role === 'ADMIN');
    await page.getByRole('main').getByLabel('Colaborador').selectOption(admin.id);
    await page.getByRole('main').getByLabel('PIN', { exact: true }).fill('1234');
    await page.getByRole('main').getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Frente de caixa' })).toBeVisible();
    await assertHeader(page);
    await page.goto('/admin');
    const tabs = page.getByRole('main').locator('nav.tabs').first();
    await expect(tabs).toBeVisible();
    for (const key of ['admin.products','orders.title','admin.users','admin.approvals','nav.reports','admin.notifications','nav.settings','admin.inventory','admin.alterations']) {
      await tabs.getByRole('button', { name: labels[key], exact: true }).click();
      await expect(tabs.getByRole('button', { name: labels[key], exact: true })).toHaveAttribute('aria-pressed', 'true');
      await assertHeader(page);
    }
    await page.goto('/configuracoes');
    await expect(page.getByText(labels['settings.identity'], { exact: true })).toBeVisible();
    await assertHeader(page);
    await page.screenshot({ path: `test-results/settings-shared-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('legal content remains available when catalog is offline', async ({ page }) => {
  await page.route('**/api/storefront/catalog', route => route.abort());
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Política de Privacidade', exact: true })).toBeVisible();
  await expect(page.locator('#cartButton')).toBeDisabled();
});

test('simulator keeps chat and inventory refresh using mocked responses', async ({ page }) => {
  let reads = 0;
  await page.route('**/api/inventory', route => { reads++; return route.fulfill({ json: { products: [], movements: [] } }); });
  await page.route('**/chat', route => {
    expect(route.request().postDataJSON()).toEqual({ telefone: '5564999999999', nome: 'Teste', mensagem: 'Teste de pedido' });
    return route.fulfill({ json: { reply: 'Resposta de teste', intent: 'ORDER_CONFIRMATION' } });
  });
  await page.goto('/simulador');
  await page.getByLabel(labels['checkout.name'], { exact: true }).fill('Teste');
  await page.getByLabel(labels['checkout.phone'], { exact: true }).fill('5564999999999');
  await page.getByLabel(labels['assistant.message'], { exact: true }).fill('Teste de pedido');
  await page.getByRole('button', { name: labels['assistant.send'], exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Resposta de teste');
  await expect.poll(() => reads).toBeGreaterThan(1);
});
