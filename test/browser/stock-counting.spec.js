const { openAdminSection } = require('./admin-navigation');
const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');

async function start(page, suffix, unit = 'UN') {
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } });
  const id = 'count-' + randomUUID();
  const name = 'Contagem ' + suffix;
  expect((await page.request.post('/api/admin/products', { data: { id, name, price: 10, stockQuantity: 20, unit, status: 'ATIVO' } })).ok()).toBe(true);
  await page.goto('/admin');
  await openAdminSection(page, 'stock');
  await page.locator('#stockSearchInput').fill(name);
  await page.locator('#stockModeEntry').click();
  const card = page.locator('#stockCardsGrid render-product-card').filter({ hasText: name });
  await expect(card).toBeVisible();
  return { id, name, card };
}

test('rapid physical taps, undo, search and reload preserve the entry before one idempotent save', async ({ page }) => {
  const { card, name, id } = await start(page, 'toques');
  const action = card.getByRole('button', { name: '＋ Contar 1 unidade', exact: true });
  await card.locator('.product-photo').click();
  await card.locator('.product-name').click();
  for (let i = 0; i < 3; i++) await action.click();
  await expect(card.locator('input')).toHaveValue('5');
  await expect(card.locator('.stock-card-balance strong')).toHaveText('20');
  await page.locator('#stockUndo').click();
  await expect(card.locator('input')).toHaveValue('4');
  await page.locator('#stockSearchInput').fill('não existe este produto');
  await expect(page.getByRole('button', { name: '＋ Cadastrar este produto' })).toBeVisible();
  await page.getByRole('button', { name: '＋ Cadastrar este produto' }).click();
  await expect(page.locator('#formProdName')).toHaveValue('não existe este produto');
  await page.getByRole('button', { name: 'Fechar cadastro de produto' }).click();
  await expect(page.locator('#tab-stock')).toBeVisible();
  page.on('dialog', dialog => dialog.accept());
  await page.reload();
  await openAdminSection(page, 'stock');
  await page.locator('#stockSearchInput').fill(name);
  await expect(card.locator('input')).toHaveValue('4');
  let failed = false;
  await page.route('**/api/admin/stock/adjustments', async route => {
    const response = await route.fetch();
    if (!failed) { failed = true; await route.abort(); return; }
    await route.fulfill({ response });
  });
  await page.locator('#stockSave').click();
  await expect(page.locator('#stockCountingStatus')).toContainText('contagem restante');
  await page.locator('#stockSave').click();
  await expect(card.locator('.stock-card-balance strong')).toHaveText('24');
  const movements = await (await page.request.get('/api/admin/stock/movements?limit=100')).json();
  expect(movements.movements.filter(row => row.productId === id)).toHaveLength(1);
});

test('physical count starts at zero, supports kg and never overwrites a concurrent stock movement', async ({ page }) => {
  const { card, id } = await start(page, 'peso KG', 'KG');
  await page.locator('#stockModeCount').click();
  await card.getByRole('button', { name: '＋ Contar 1 kg', exact: true }).click();
  await expect(card.locator('input')).toHaveValue('1');
  await card.locator('input').fill('2.75'); await card.locator('input').blur();
  expect((await page.request.post('/api/admin/stock/adjustments', { data: { productId: id, operation: 'ENTRY', quantity: 1, requestId: randomUUID() } })).ok()).toBe(true);
  await page.locator('#stockSave').click();
  await expect(page.locator('#stockCountingStatus')).toContainText('estoque mudou');
  page.on('dialog', dialog => dialog.accept()); await page.reload();
  await openAdminSection(page, 'stock');
  await page.locator('#stockSearchInput').fill('Contagem peso KG');
  await card.getByRole('button', { name: 'Recomeçar este produto' }).click();
  await card.locator('input').fill('2.75'); await card.locator('input').blur();
  await page.locator('#stockSave').click();
  await expect(card.locator('.stock-card-balance strong')).toHaveText('2.75');
  await card.locator('input').fill('0'); await card.locator('input').blur();
  await page.locator('#stockSave').click();
  await expect(card.locator('.stock-card-balance strong')).toHaveText('0');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/stock-counting-mobile.png' });
});


test('missing product is registered and returns to stock counting without losing another product draft', async ({ page }) => {
  const { name, card } = await start(page, 'cadastro');
  await card.getByRole('button', { name: '＋ Contar 1 unidade', exact: true }).click();
  const newName = 'Muda nova ' + randomUUID().slice(0, 8);
  await page.locator('#stockSearchInput').fill(newName);
  await page.getByRole('button', { name: '＋ Cadastrar este produto' }).click();
  await expect(page.locator('#formProdName')).toHaveValue(newName);
  await page.locator('#formProdCat').fill('Plantas / Mudas');
  await page.locator('#formProdPrice').fill('5');
  page.on('dialog', dialog => dialog.accept());
  await page.locator('#prodForm button[type=submit]').click();
  await expect(page.locator('#tab-stock')).toBeVisible();
  const newCard = page.locator('#stockCardsGrid render-product-card').filter({ hasText: newName });
  await newCard.getByRole('button', { name: '＋ Contar 1 unidade', exact: true }).click();
  await expect(newCard.locator('input')).toHaveValue('1');
  await page.locator('#stockSearchInput').fill(name);
  await expect(card.locator('input')).toHaveValue('1');
  await expect(page.locator('#stockSave')).toContainText('(2)');
  await page.locator('#stockSave').click();
  await expect(page.locator('#stockCountingStatus')).toContainText('2 produto(s) salvo(s)');
});
