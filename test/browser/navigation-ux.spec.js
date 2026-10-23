const { test, expect } = require('@playwright/test');
const { summarizeExecutivePeriod } = require('../../src/reports/period-executive-metrics');
const login = page => page.request.post('/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } });

test('menu abre no primeiro clique da home, navega pelas seções e Voltar retorna à seção anterior', async ({ page }) => {
  await login(page); await page.goto('/');
  await page.locator('#adminSettingsButton').click();
  const drawer = page.getByRole('dialog', { name: 'Navegação da loja' });
  await expect(drawer).toBeVisible();
  for (const href of ['/caixa', '/admin?tab=orders', '/admin?tab=stock', '/admin?tab=products', '/admin?tab=team', '/admin?tab=status', '/caixa?view=deliveries', '/configuracoes', '/admin-gerencial']) await expect(drawer.locator('a[href="' + href + '"]')).toBeVisible();
  await drawer.locator('a[href="/admin?tab=stock"]').click();
  await expect(page.locator('#tab-stock')).toHaveClass(/active/);
  await expect(page.locator('.nav-tabs')).toHaveCount(0);
  await page.locator('conflora-topbar .cf-topbar-menu').click();
  await page.locator('#siteNavigationDrawer a[href="/admin?tab=products"]').click();
  await expect(page.locator('#tab-products')).toHaveClass(/active/);
  await page.goBack();
  await expect(page.locator('#tab-stock')).toHaveClass(/active/);
  await expect(page.locator('.cf-notification-button')).toBeVisible();
  await expect(page.locator('.cf-work-actions .cf-danger-button')).toHaveCSS('background-color', 'rgb(220, 38, 38)');
});

test('identificação do operador e navegação fecham ao clicar fora', async ({ page }) => {
  await page.goto('/admin'); await expect(page.locator('#loginModal')).toHaveClass(/open/);
  await page.locator('#loginModal h3').click(); await expect(page.locator('#loginModal')).toHaveClass(/open/);
  await page.mouse.click(2, 2); await expect(page.locator('#loginModal')).not.toHaveClass(/open/);
  await login(page); await page.evaluate(() => window.sessionStorage.clear()); await page.reload();
  await page.locator('conflora-topbar .cf-topbar-menu').click();
  await page.screenshot({ path: 'test-results/navigation-drawer.png' });
  await page.mouse.click(2, 2); await expect(page.locator('#siteNavigationDrawer')).not.toBeVisible();
});

test('caixa distribui produtos e recibo sem sobreposição e não mostra atalho para si mesmo', async ({ page }) => {
  await login(page); await page.goto('/caixa');
  await expect(page.locator('conflora-topbar .cf-topbar-cashier')).toBeHidden();
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(size.scroll).toBeLessThanOrEqual(size.client);
    if (width >= 1024) {
      const products = await page.locator('.cf-pos-products').boundingBox();
      const receipt = await page.locator('.cf-cashier-receipt').boundingBox();
      const commands = await page.locator('.cashier-command-nav').boundingBox();
      expect(products.x + products.width + 16).toBeLessThanOrEqual(receipt.x);
      expect(commands.x + commands.width).toBeLessThan(receipt.x);
      expect(Math.abs(products.width / receipt.width - 2)).toBeLessThan(0.02);
      expect(receipt.x + receipt.width).toBeLessThanOrEqual(width);
    }
  }
  await page.screenshot({ path: 'test-results/cashier-proportions.png' });
});

test('e-mail duplicado exibe alerta vermelho com foco e orientação para buscar cliente', async ({ page }) => {
  await login(page);
  await page.route('**/api/caixa/customers', route => route.request().method() === 'POST' ? route.fulfill({ status: 409, json: { error: 'Este e-mail já está vinculado a outro cadastro de cliente.' } }) : route.continue());
  await page.goto('/caixa');
  await page.getByRole('button', { name: 'Adicionar cliente', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Identificar cliente', exact: true });
  await dialog.getByLabel('Nome do Cliente', { exact: true }).fill('Cliente duplicado');
  await dialog.getByLabel('E-mail da conta do cliente (opcional):', { exact: true }).fill('existente@test.com');
  await dialog.getByRole('button', { name: 'Adicionar cliente', exact: true }).click();
  const error = dialog.getByRole('alert');
  await expect(error).toContainText('BUSCAR CLIENTE'); await expect(error).toBeFocused();
  await expect(error).toHaveCSS('background-color', 'rgb(254, 242, 242)');
  await page.screenshot({ path: 'test-results/customer-duplicate-error.png' });
});

test('painel destaca números e os líderes reais de janeiro e fevereiro sem quebrar no celular', async ({ page }) => {
  await login(page);
  const orders = [{ createdAt: '2026-01-15T12:00:00Z', status: 'CONFIRMED', paymentStatus: 'APPROVED', total: 50, items: [{ productId: 'orange', name: 'Laranja', quantity: 10, price: 5 }] }, { createdAt: '2026-02-15T12:00:00Z', status: 'CONFIRMED', paymentStatus: 'APPROVED', total: 100, items: [{ productId: 'flower', name: 'Flores', quantity: 5, price: 20 }] }];
  await page.route('**/api/admin/executive-period-metrics?*', route => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: summarizeExecutivePeriod({ from: url.searchParams.get('from'), to: url.searchParams.get('to'), comparisonMode: url.searchParams.get('comparisonMode'), orders, catalog: [{ id: 'orange', name: 'Laranja', saleUnit: 'KG' }, { id: 'flower', name: 'Flores' }, { id: 'zero', name: 'Sem venda' }] }) });
  });
  await page.goto('/admin-gerencial');
  await expect(page.getByRole('heading', { name: 'Resultados da loja' })).toBeVisible();
  await page.locator('#btnTabAnalytics').click();
  await page.getByLabel('Ano do histórico mensal').fill('2026'); await page.getByLabel('Ano do histórico mensal').dispatchEvent('change');
  await expect(page.locator('#monthlyLeaders tr')).toHaveCount(12);
  await expect(page.locator('#monthlyLeaders tr').nth(0)).toContainText('Laranja');
  await expect(page.locator('#monthlyLeaders tr').nth(1)).toContainText('Flores');
  await page.getByLabel('Mês das vendas').fill('2026-01'); await page.getByLabel('Mês das vendas').dispatchEvent('change');
  await expect(page.locator('#periodSales')).toContainText('50,00');
  await expect(page.locator('#periodLeastValue')).toContainText('Sem venda');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/management-' + width + '.png', fullPage: true });
  }
});

test('perfil altera somente dados da própria conta, sem aceitar cargo ou e-mail enviado pelo cliente', async ({ page }) => {
  await login(page);
  const original = (await (await page.request.get('/api/auth/me')).json()).user;
  try {
    const response = await page.request.patch('/api/auth/profile', { data: { name: 'Perfil de teste', phone: '64999991234', address: 'Rua Teste, 10', role: 'CLIENTE', email: 'outro@test.com', id: 'usr-caixa1' } });
    expect(response.ok()).toBe(true);
    const { user } = await response.json();
    expect(user.role).toBe(original.role); expect(user.id).toBe(original.id); expect(user.email).toBe(original.email);
    await page.goto('/?conta=1&editar=1');
    await expect(page.locator('#accountTitle')).toHaveText('Editar meu perfil');
    await expect(page.getByLabel('Nome completo', { exact: true })).toHaveValue('Perfil de teste');
  } finally { await page.request.patch('/api/auth/profile', { data: { name: original.name, phone: original.phone || '', address: original.address || '' } }); }
});
