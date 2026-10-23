const { test, expect } = require('@playwright/test');
const { ensureCashierSession } = require('./cashier-session');

async function login(page) {
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } });
  await ensureCashierSession(page);
  await page.goto('/pdv');
  await expect(page.getByRole('button', { name: '+ Novo produto', exact: true })).toBeVisible();
}

test('mobile quick registration preserves sale, adds confirmed product and recovers from network failure', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByText('Planta Teste', { exact: true }).click();
  await page.getByText('Begônia', { exact: true }).click();
  await expect(page.locator('.cf-mobile-cart-bar')).toContainText('2 itens');
  await page.getByLabel('Buscar produto', { exact: true }).fill('Produto UX isolado');
  await page.getByRole('button', { name: '+ Novo produto', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo produto', exact: true });
  await expect(dialog.getByLabel(/Nome do produto/)).toHaveValue('Produto UX isolado');
  await dialog.getByLabel(/Preço por/).fill('12.50');
  await dialog.getByText('Mais opções', { exact: true }).click();
  await dialog.getByLabel(/Estoque inicial/).fill('10');
  await page.route('**/api/caixa/products', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await dialog.getByRole('button', { name: 'Salvar e adicionar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel(/Nome do produto/)).toHaveValue('Produto UX isolado');
  await page.unroute('**/api/caixa/products');
  await dialog.getByRole('button', { name: 'Salvar e adicionar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.cf-mobile-cart-bar')).toContainText('3 itens');
  await expect(page.locator('render-product-card').getByText('Produto UX isolado', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/ux/ux-sale-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Ver carrinho →' }).click();
  await expect(page.getByText('Planta Teste', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Begônia', { exact: true }).last()).toBeVisible();
  expect(await page.locator('html').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'PAGAR', exact: true }).click();
  await page.getByRole('button', { name: 'Dinheiro', exact: true }).click();
  await page.getByRole('button', { name: 'Finalizar venda', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nova venda', exact: true })).toBeVisible();
});

test('save only, similar product suggestions and responsive dialog', async ({ page }) => {
  await login(page);
  for (const width of [320, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 780 });
    await page.getByRole('button', { name: '+ Novo produto', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Novo produto' });
    await dialog.getByLabel(/Nome do produto/).fill('Planta Teste');
    await expect(dialog.getByText('Já existe um produto parecido.')).toBeVisible();
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  }
  await page.getByRole('button', { name: '+ Novo produto', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo produto' });
  await dialog.getByLabel(/Nome do produto/).fill('Produto salvo sem venda UX');
  await dialog.getByLabel(/Preço por/).fill('7.00');
  await dialog.getByRole('button', { name: 'Salvar produto', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Produto salvo sem venda UX', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/ux/ux-sale-desktop.png', fullPage: true });
});

test('product API rejects unauthorized and invalid writes; retried request creates one product', async ({ request }) => {
  expect((await request.post('/api/caixa/products', { data: {} })).status()).toBe(401);
  await request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } });
  expect((await request.post('/api/caixa/products', { data: { name: 'X', price: -1 } })).status()).toBe(400);
  const payload = { requestId: require('node:crypto').randomUUID(), name: 'Produto idempotente UX', price: 10, unit: 'UN', stockQuantity: 3 };
  const first = await request.post('/api/caixa/products', { data: payload });
  expect(first.ok()).toBe(true);
  const second = await request.post('/api/caixa/products', { data: payload });
  expect(second.ok()).toBe(true);
  expect((await second.json()).product.id).toBe((await first.json()).product.id);
  const products = await (await request.get('/api/caixa/products')).json();
  expect(products.filter(product => product.name === payload.name)).toHaveLength(1);
});
