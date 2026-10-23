const { test, expect } = require('@playwright/test');
const messages = require('../../src/i18n/messages.json');
const { ensureCashierSession } = require('./cashier-session');
const cashierSearch = Object.values(messages).find(value => value.pt === 'Nome, categoria ou descrição (Ex.: plantas de sombra, plantas para jardim, flores, e etc)');

async function openCashier(page) {
  await expect.poll(() => page.evaluate(async () => (await window.ConfloraSession.apiFetch('/api/auth/me')).status)).toBe(200);
  await ensureCashierSession(page);
  await page.reload();
}

test('Portuguese is the default and language selection persists across pages without changing account roles', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  await page.goto('/pdv');
  await expect(page.getByLabel('Usuário')).toBeVisible();
  expect(await page.evaluate(() => window.getLanguage())).toBe('pt');
  await page.getByLabel('Usuário').selectOption('usr-caixa1');
  await page.getByLabel('PIN', { exact: true }).fill('0000');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await openCashier(page);
  await expect(page.locator('.cashier-command-nav')).toBeVisible();
  for (const language of ['en', 'es', 'fr', 'pt']) {
    await page.locator('.cf-topbar-language').selectOption(language);
    await expect(page.locator('html')).toHaveAttribute('lang', language === 'pt' ? 'pt-BR' : language);
    await expect(page.locator('.cf-topbar-search input')).toHaveAttribute('placeholder', cashierSearch[language]);
  }
  await page.evaluate(() => window.setLanguage('en'));
  await page.reload();
  await expect(page.locator('.cashier-command-nav')).toBeVisible();
  expect(await page.evaluate(async () => (await (await window.ConfloraSession.apiFetch('/api/auth/me')).json()).user.role)).toBe('CAIXA');
  for (const path of ['/', '/admin', '/admin-gerencial', '/guias/caixa.html']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  }
  expect(errors).toEqual([]);
  await context.close();
});

test('PIX uses the supplied image and pulses only when selected, respecting reduced motion', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  await page.goto('/pdv');
  await page.getByLabel('Usuário').selectOption('usr-caixa1');
  await page.getByLabel('PIN', { exact: true }).fill('0000');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await openCashier(page);
  await page.getByText('Planta Teste', { exact: true }).click();
  await page.getByRole('button', { name: /PAGAR - F1/ }).click();
  const pix = page.locator('[data-payment-method="pix"]');
  const logo = pix.locator('img');
  await pix.click();
  await expect(pix).toHaveAttribute('aria-pressed', 'true');
  await expect(logo).toHaveAttribute('src', '/storefront/images/pix-image.png');
  await expect(logo).toHaveCSS('animation-name', 'cfPixPulse');
  await page.locator('[data-payment-method="dinheiro"]').click();
  await expect(logo).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await pix.click();
  await expect(logo).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(pix).toBeVisible();
  await page.screenshot({ path: 'test-results/pix-checkout-mobile.png' });

  await page.goto('/products/test-plant');
  await page.getByRole('button', { name: messages.catalog_add_to_cart.pt, exact: true }).click();
  await page.locator('#cartButton').click();
  const pixChoice = page.locator('.is-choice-pix');
  await pixChoice.locator('input').check();
  await expect(pixChoice.locator('img')).toHaveCSS('animation-name', 'pix-icon-pulse');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(pixChoice.locator('img')).toHaveCSS('animation-name', 'none');
  expect(errors).toEqual([]);
});
