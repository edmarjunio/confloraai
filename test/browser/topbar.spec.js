const { ensureCashierSession } = require('./cashier-session');
const { test, expect } = require('@playwright/test');

test('one topbar keeps the cashier button aligned across the catalog, admin, PDV and management at every width', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => window.localStorage.setItem('conflora_lang', 'pt'));
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } });
  await ensureCashierSession(page);
  const references = new Map();
  for (const route of ['/', '/admin', '/pdv', '/admin-gerencial']) {
    await page.goto(route);
    const bar = page.locator('.cf-topbar-layout');
    if (route === '/pdv') await expect(bar.locator('.cf-topbar-cashier')).toBeHidden();
    else await expect(bar.locator('.cf-topbar-cashier')).toBeVisible();
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      if (route === '/pdv' && width < 1024) {
        await expect(page.locator('.cf-mobile-sale-heading')).toBeVisible();
        await expect(page.locator('.cf-mobile-search input')).toBeVisible();
        expect(await page.locator('html').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
        continue;
      }
      const boxes = await bar.evaluate(header => {
        const box = selector => { const rect = header.querySelector(selector).getBoundingClientRect(); return { x: rect.x, y: rect.y, right: rect.right, width: rect.width }; };
        return { brand: box('.cf-topbar-brand'), cashier: box('.cf-topbar-cashier'), search: box('.cf-topbar-search'), buttons: [...header.querySelectorAll('.cf-topbar-pill')].filter(item => !item.hidden).map(item => ({ radius: window.getComputedStyle(item).borderRadius, ...item.getBoundingClientRect().toJSON() })) };
      });
      expect(boxes.cashier.right).toBeLessThanOrEqual(width);
      expect(boxes.brand.x).toBeGreaterThanOrEqual(0);
      expect(boxes.search.width).toBeGreaterThan(100);
      for (const button of boxes.buttons) expect(parseFloat(button.radius)).toBeGreaterThanOrEqual(12);
      if (route === '/') references.set(width, boxes);
      else {
        expect(Math.abs(boxes.brand.x - references.get(width).brand.x)).toBeLessThan(2);
        if (route !== '/pdv') expect(Math.abs(boxes.cashier.right - references.get(width).cashier.right), JSON.stringify({ route, width, current: boxes.cashier, reference: references.get(width).cashier })).toBeLessThan(2);
      }
      if (route === '/pdv' && width >= 1024) {
        const receipt = await page.locator('.cf-cashier-receipt').boundingBox();
        const header = await bar.boundingBox();
        expect(receipt.y).toBeGreaterThanOrEqual(header.y + header.height);
      }
      if (width === 390 || width === 1440) await page.screenshot({ path: 'test-results/topbar-' + (route.replace(/\W/g, '') || 'catalog') + '-' + width + '.png' });
    }
    if (route === '/admin') {
      await expect(bar.getByRole('link', { name: 'Painel Gerencial' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Opções administrativas' })).toBeVisible();
    }
  }
});

test('staff topbar search filters registered products within the admin panel', async ({ page }) => {
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } });
  await ensureCashierSession(page);
  await page.goto('/admin');
  await require('./admin-navigation').openAdminSection(page, 'products');
  const search = page.locator('conflora-topbar input');
  await search.fill('Begônia'); await search.press('Enter');
  await expect(page.locator('#tab-products')).toHaveClass(/active/);
  await expect(page.locator('#adminProductsGrid render-product-card')).toHaveCount(1);
  await expect(page.locator('#adminProductsGrid')).toContainText('Begônia');
});

test('cashier topbar returns from commands without dropping an unfinished sale', async ({ page }) => {
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } });
  await ensureCashierSession(page);
  await page.goto('/pdv');
  await page.getByPlaceholder('Nome, categoria ou descrição (Ex.: plantas de sombra, plantas para jardim, flores, e etc)').fill('Planta Teste');
  await page.getByText('Planta Teste', { exact: true }).click();
  await page.keyboard.press('F2');
  await expect(page.getByRole('complementary', { name: 'Ações das comandas' })).toBeVisible();
  await page.locator('conflora-topbar .cf-topbar-cashier').click();
  await expect(page.locator('conflora-topbar input')).toHaveValue('Planta Teste');
  await expect(page.getByRole('button', { name: /PAGAR - F1/ })).toBeEnabled();
});
