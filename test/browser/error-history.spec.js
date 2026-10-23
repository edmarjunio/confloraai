const { ensureCashierSession } = require('./cashier-session');
const { test, expect } = require('@playwright/test');

test('admin acompanha falha do navegador como texto; página não fica consultando em segundo plano', async ({ page }) => {
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } });
  await ensureCashierSession(page);
  await page.goto('/admin?tab=status');
  await expect(page.getByRole('heading', { name: 'Histórico de erros', exact: true })).toBeVisible();
  const capture = page.waitForResponse(response => response.url().endsWith('/api/client-errors') && response.status() === 202);
  await page.evaluate(() => {
    window.dispatchEvent(new window.ErrorEvent('error', { message: '<img src=x onerror=alert(1)> Falha isolada de interface', error: new Error('Falha isolada de interface'), filename: window.location.origin + '/store-assets/app.js' }));
  });
  await capture;
  await page.getByRole('button', { name: 'Atualizar histórico', exact: true }).click();
  await expect(page.locator('#errorHistoryList')).toContainText('Falha isolada de interface');
  expect(await page.locator('#errorHistoryList img').count()).toBe(0);
  await expect(page.getByRole('button', { name: 'Testar notificações WhatsApp' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/error-history-admin.png', fullPage: true });
});
