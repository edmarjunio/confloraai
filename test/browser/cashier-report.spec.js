const { ensureCashierSession } = require('./cashier-session');
const { openAdminSection } = require('./admin-navigation');
const { test, expect } = require('@playwright/test');

test('admin types 100 over a negative stock and sees a clear inventory state banner', async ({ page }) => {
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } });
  await ensureCashierSession(page);
  const name = 'Estoque legado negativo';
  await page.goto('/admin'); await openAdminSection(page, 'stock');
  await page.locator('#stockSearchInput').fill(name);
  await expect(page.locator('#stockModeCount')).toHaveAttribute('aria-pressed', 'true');
  const card = page.locator('#stockCardsGrid render-product-card').filter({ hasText: name });
  await expect(card.locator('.stock-card-balance strong')).toHaveText('-25');
  await card.locator('input').fill('100'); await card.locator('input').blur();
  await expect(card.locator('.stock-count-preview')).toContainText('Contado: 100');
  await page.locator('#stockSave').click();
  await expect(card.locator('.stock-card-balance strong')).toHaveText('100');
  await expect(page.locator('#stockControlBanner')).toBeVisible();
  await expect(page.locator('#stockControlToggle')).toContainText(/Estoque ativo|Venda livre/);
  await page.locator('#stockControlBanner').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/stock-numeric-100.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#stockControlBanner').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/stock-control-mobile.png' });
});

test('cashier exports a private PDF at any time and sends it with one button', async ({ page }) => {
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } });
  await ensureCashierSession(page);
  await page.goto('/admin');
  const actions = page.locator('#adminCashierReport');
  await expect(actions).toContainText('Somente o seu caixa');
  const download = page.waitForEvent('download');
  await actions.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
  await (await download).saveAs('test-results/cashier-snapshot.pdf');
  let sends = 0;
  await page.route('**/api/caixa/report/send-whatsapp', route => { sends += 1; return route.fulfill({ json: { success: true, message: 'PDF enviado ao WhatsApp da loja.' } }); });
  await actions.getByRole('button', { name: 'Enviar PDF no WhatsApp' }).click();
  await expect(actions.getByRole('status')).toContainText('PDF enviado');
  expect(sends).toBe(1);
  await page.screenshot({ path: 'test-results/cashier-report-actions.png' });
});


test('PDV report also downloads the selected period with cashier-only scope', async ({ page }) => {
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } });
  await ensureCashierSession(page);
  await page.goto('/pdv');
  await expect(page.getByPlaceholder('Nome, categoria ou descrição (Ex.: plantas de sombra, plantas para jardim, flores, e etc)')).toBeVisible();
  await page.keyboard.press('F3');
  const actions = page.locator('cashier-report-actions');
  await expect(actions).toContainText('Somente o seu caixa');
  const download = page.waitForEvent('download');
  await actions.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('relatorio-caixa.pdf');
});
