const { openAdminSection } = require('./admin-navigation');
const { test, expect } = require('@playwright/test');

test('partial payment requires a second method and keeps scrolling within the dialog', async ({ page }) => {
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } });
  const response = await page.request.post('/api/caixa/orders', { data: { requestId: require('node:crypto').randomUUID(), items: [{ productId: 'test-plant', quantity: 1 }], paymentMethod: 'DINHEIRO', deferToCashier: true, customerName: 'Pagamento parcial teste' } });
  expect(response.ok()).toBe(true);
  const { order } = await response.json();
  await page.goto('/pdv');
  await expect(page.getByPlaceholder('Nome, categoria ou descrição (Ex.: plantas de sombra, plantas para jardim, flores, e etc)')).toBeVisible();
  await page.keyboard.press('F2');
  await expect(page.getByRole('region', { name: 'ESPERANDO ENTREGADOR', exact: true })).toBeAttached();
  await expect(page.getByRole('region', { name: 'SAIU PARA ENTREGA', exact: true })).toBeAttached();
  await page.getByRole('button', { name: 'Abrir recibo e detalhes da comanda ' + order.ticketNumber }).click();
  const dialog = page.getByRole('dialog', { name: 'Comanda #' + order.ticketNumber });
  await dialog.getByLabel('Valor nesta forma de pagamento (R$)').fill('10');
  await expect(dialog.getByRole('status')).toContainText('15,00');
  await expect(dialog.getByRole('button', { name: 'Confirmar pagamento e finalizar' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Adicionar outra forma de pagamento' }).click();
  await expect(dialog.getByLabel('Valor da parcela 1')).toHaveValue('10.00');
  await expect(dialog.getByLabel('Valor da parcela 2')).toHaveValue('15.00');
  await dialog.getByLabel('Valor da parcela 2').fill('14');
  await expect(dialog.getByRole('button', { name: 'Confirmar pagamento e finalizar' })).toBeDisabled();
  await dialog.getByLabel('Valor da parcela 2').fill('15');
  await expect(dialog.getByRole('button', { name: 'Confirmar pagamento e finalizar' })).toBeEnabled();
  await expect(dialog).toHaveCSS('overflow', 'hidden');
  await dialog.getByRole('button', { name: 'Confirmar pagamento e finalizar' }).click();
  await expect(dialog).toContainText('Pago / finalizado');
  await expect(dialog.getByRole('button', { name: 'Confirmar pagamento e finalizar' })).toHaveCount(0);
});

test('product gallery highlights cover, reorders originals and opens full-screen preview', async ({ page }) => {
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } });
  await page.goto('/admin');
  await openAdminSection(page, 'products');
  await page.getByRole('button', { name: '＋ ADICIONAR PRODUTO', exact: true }).click();
  const buffer = require('node:fs').readFileSync('public/storefront/brands/conflora-logo.png');
  await page.locator('#formProdPhotoFile').setInputFiles([
    { name: 'primeira.png', mimeType: 'image/png', buffer },
    { name: 'segunda.png', mimeType: 'image/png', buffer },
  ]);
  const grid = page.locator('#formProdPhotosGrid');
  await expect(grid.locator(':scope > div').first()).toHaveCSS('grid-column', '1 / -1');
  const secondPhoto = await grid.locator('img').nth(1).getAttribute('src');
  await grid.getByTitle('Mover foto antes').last().click();
  await expect(grid.locator('img').first()).toHaveAttribute('src', secondPhoto);
  await grid.getByRole('button', { name: 'Ampliar foto 1', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Foto ampliada do produto' });
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.locator('img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/product-photo-preview.png' });
  await expect(preview.locator('img')).toHaveAttribute('src', secondPhoto);
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
});

test('category buttons have room for their raised hover effect', async ({ page }) => {
  await page.goto('/');
  const chip = page.locator('.category-chip').first();
  await expect(chip).toBeVisible();
  await chip.hover();
  const bounds = await chip.evaluate(button => {
    const item = button.getBoundingClientRect();
    const parent = button.parentElement.getBoundingClientRect();
    return { top: item.top - parent.top, bottom: parent.bottom - item.bottom };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(2);
  expect(bounds.bottom).toBeGreaterThanOrEqual(10);
});

test('sales table translates pending status and keeps customer, amount and actions on one line', async ({ page }) => {
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } });
  await page.route('**/api/admin/daily-metrics*', route => route.fulfill({ json: { totalRevenue: 25, todayOrders: [{ id: 'display-test', customerName: 'Cliente com nome completo', total: 25, paymentMethod: 'DINHEIRO', status: 'AWAITING_PAYMENT', items: [{ name: 'Produto com descrição longa para ocupar o espaço restante', quantity: 1 }] }] } }));
  await page.goto('/admin');
  const row = page.locator('#todayOrdersBody tr').first();
  await expect(row).toContainText('AGUARDANDO PAGAMENTO');
  for (const column of [1, 4, 6]) await expect(row.locator('td').nth(column)).toHaveCSS('white-space', 'nowrap');
  await expect(row.locator('td').nth(2)).toHaveCSS('white-space', 'normal');
});

test('admin product cards edit legacy photos and identify illustrative images without saving them', async ({ page }) => {
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } });
  await page.route('**/api/inventory', route => route.fulfill({ json: [
    { id: 'legacy-photo', name: 'Foto antiga', price: 12, category: 'Horta', status: 'ATIVO', fotoUrl: '/store-assets/brands/conflora-logo.png' },
    { id: 'illustrative-photo', name: 'Sem foto própria', price: 10, category: 'Horta', status: 'ATIVO', imageFallbackUrl: '/store-assets/brands/conflora-logo.png' },
  ] }));
  await page.goto('/admin');
  await openAdminSection(page, 'products');
  const cards = page.locator('#adminProductsGrid render-product-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.locator('[data-action="add"]')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/admin-product-cards.png' });
  await cards.filter({ hasText: 'Foto antiga' }).getByRole('button', { name: 'Editar produto', exact: true }).click();
  await expect(page.locator('#formProdPhotosGrid img')).toHaveAttribute('src', '/store-assets/brands/conflora-logo.png');
  await expect.poll(() => page.locator('#formProdPhotosGrid img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Fechar cadastro de produto' }).click();
  await cards.filter({ hasText: 'Sem foto própria' }).getByRole('button', { name: 'Editar produto', exact: true }).click();
  await expect(page.locator('#formProdPhotosGrid')).toContainText('Imagem ilustrativa do catálogo');
  await expect(page.locator('#formProdPhotoCount')).toHaveText('0');
  await expect(page.locator('#formProdPhotosGrid img')).toBeVisible();
});

test('admin uses current product assets despite an older public cache and keeps cards sized on desktop and mobile', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => page.evaluate(() => Boolean(window.navigator.serviceWorker.controller))).toBe(true);
  await page.evaluate(async () => {
    const name = (await window.caches.keys()).find(key => key.startsWith('conflora-public-shell-'));
    const cache = await window.caches.open(name);
    await cache.put('/store-assets/design-system.css', new window.Response('/* Old release without admin grid */', { headers: { 'Content-Type': 'text/css' } }));
    await cache.put('/store-assets/product-card.js', new window.Response('/* Old release without admin edit variant */', { headers: { 'Content-Type': 'application/javascript' } }));
  });
  await page.evaluate(async () => {
    const response = await window.fetch('/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'usr-edmar', pin: '1234' }) });
    if (!response.ok) throw new Error('Login do administrador não foi concluído.');
  });
  await page.goto('/admin');
  await openAdminSection(page, 'products');
  const grid = page.locator('#adminProductsGrid');
  const cards = grid.locator('render-product-card');
  await expect(cards.first().getByRole('button', { name: 'Editar produto', exact: true })).toBeVisible();
  await expect(grid).toHaveCSS('display', 'grid');
  for (const width of [1600, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await cards.evaluateAll(elements => elements.slice(0, 2).map(card => {
      const rect = card.getBoundingClientRect();
      const image = card.querySelector('img').getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, imageWidth: image.width, imageHeight: image.height };
    }));
    expect(dimensions[0].width).toBeLessThan(width > 500 ? 320 : 200);
    expect(dimensions[1].y).toBe(dimensions[0].y);
    expect(dimensions[1].x).toBeGreaterThan(dimensions[0].x);
    expect(dimensions[0].imageHeight).toBeLessThan(240);
    expect(dimensions[0].imageWidth).toBeLessThanOrEqual(dimensions[0].width);
    await expect(cards.locator('[data-action="add"]')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/admin-catalog-' + width + '.png' });
  }
});
