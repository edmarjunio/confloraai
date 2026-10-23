const { ensureCashierSession } = require('./cashier-session');
const { test, expect } = require('@playwright/test');

for (const operator of [
  { id: 'usr-caixa1', pin: '0000', role: 'CAIXA' },
  { id: 'usr-edmar', pin: '1234', role: 'ADMIN' },
]) {
  test(`cashier renders after ${operator.role} login and reopening the page`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    try {
      await page.goto('/pdv');
      await page.getByLabel('Usuário').selectOption(operator.id);
      await page.getByLabel('PIN', { exact: true }).fill(operator.pin);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await ensureCashierSession(page);
      await expect(page.locator('.cashier-command-nav')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Informações de Planta Teste' })).toBeVisible();

      await page.reload();
      await expect(page.locator('.cashier-command-nav')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Informações de Planta Teste' })).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('.cf-pos-categories')).toBeVisible();
      // Dynamically rendered category bars retain the shared drag-scroll behavior.
      await expect.poll(() => page.locator('.cf-pos-categories [data-drag-scroll]').first()
        .evaluate(node => node.__cfDragScrollBound === true)).toBe(true);
    } finally {
      expect(errors).toEqual([]);
    }
  });
}
