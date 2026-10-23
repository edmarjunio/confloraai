const { ensureCashierSession } = require('./cashier-session');
const { test, expect } = require('@playwright/test');

test('PDV opens without test banner, uses real login and sends an empty cart until selected', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/caixa/products', async (route) => {
    const response = await route.fetch();
    const existing = await response.json();
    const additions = Array.from({ length: 130 }, (_, index) => ({
      id: `lazy-product-${index + 1}`,
      sku: `lazy-sku-${index + 1}`,
      name: `Produto Carregamento ${index + 1}`,
      category: 'geral',
      price: 2,
      stock: 20,
      unit: 'UN',
      imageUrl: index === 129 ? '' : index === 128 ? '/missing-product-photo.png' : '/storefront/placeholder.svg',
      images: index === 129 ? ['data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='] : [],
      imageFallbackUrl: index === 128 ? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3Crect width="1" height="1" fill="green"/%3E%3C/svg%3E' : '',
      descriptionAi: index === 129 ? 'Plantas de sombra para jardim.' : '',
      details: index === 129 ? [{ label: 'Cuidados', value: 'Manter em local protegido.' }] : [],
    }));
    await route.fulfill({ response, json: [...additions, ...existing] });
  });
  await page.goto('/pdv');
  await expect(page.getByRole('heading', { name: 'Frente de caixa' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conflora - página inicial' }).first()).toHaveAttribute('href', '/');
  await page.getByLabel('Usuário').selectOption('usr-caixa1');
  await page.getByLabel('PIN', { exact: true }).fill('0000');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await ensureCashierSession(page);
  await expect(page.getByRole('link', { name: 'Conflora - página inicial' }).first()).toHaveAttribute('href', '/');
  await expect(page.locator('.cf-topbar-identity').getByText('Atendente do Caixa', { exact: true })).toBeVisible();
  await expect(page.locator('.cf-topbar-identity small')).toHaveText('CAIXA');
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toHaveCSS('background-color', 'rgb(220, 38, 38)');
  await expect(page.locator('header').getByText('Conflora Horta e Viveiro')).toHaveCount(0);
  await expect(page.locator('header').getByText('Mineiros - GO')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /FAVORITOS/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Bebidas & Empório|Drinks/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Plantas / Mudas', exact: true })).toBeVisible();
  await expect(page.getByText('ITEM', { exact: true })).toHaveCount(0);
  const shortcutLabels = await page.locator('nav[aria-label="Ações do caixa por atalho"] button').allTextContents();
  expect(shortcutLabels.map((label) => label.trim().slice(0, 2))).toEqual(['F1', 'F2', 'F3', 'F4', 'F8', 'F9']);
  await expect(page.getByRole('button', { name: /Escanear|Leitor de Código/i })).toHaveCount(0);
  await expect(page.getByText('Computador (2/3 + 1/3)')).toHaveCount(0);
  await expect(page.getByText('Tela 2/3 e 1/3')).toHaveCount(0);
  const productInformationButtons = page.locator('button[aria-label^="Informações de "]');
  const productsVisibleBeforeScroll = await productInformationButtons.count();
  await page.locator('main [aria-live="polite"]').scrollIntoViewIfNeeded();
  await expect.poll(() => productInformationButtons.count()).toBeGreaterThan(productsVisibleBeforeScroll);
  const search = page.getByPlaceholder('Nome, categoria ou descrição (Ex.: plantas de sombra, plantas para jardim, flores, e etc)');
  await search.fill('Produto Carregamento 130');
  await expect(page.getByText('Produto Carregamento 130', { exact: true })).toBeVisible();
  await expect(page.locator('img[alt="Produto Carregamento 130"]')).toHaveAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=');
  await page.getByRole('button', { name: 'Informações de Produto Carregamento 130' }).click();
  const productInformation = page.getByRole('dialog', { name: 'Informações de Produto Carregamento 130' });
  await expect(productInformation.getByText('Manter em local protegido.')).toBeVisible();
  await productInformation.getByRole('button', { name: 'Fechar informações' }).click();
  await search.fill('Plantas de sombra');
  await expect(page.getByText('Produto Carregamento 130', { exact: true })).toBeVisible();
  await search.fill('Produto Carregamento 129');
  await expect(page.locator('img[alt="Produto Carregamento 129"]')).toHaveAttribute('src', /data:image\/svg\+xml/);
  await search.fill('Planta Teste');
  await page.getByText('Planta Teste', { exact: true }).click();
  await page.getByRole('button', { name: /PAGAR - F1/ }).click();
  await page.getByRole('button', { name: 'Dinheiro', exact: true }).click();
  await page.getByRole('button', { name: 'Finalizar venda', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Venda finalizada', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Pagamento confirmado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nova venda', exact: true }).click();
  await search.fill('');
  await page.keyboard.press('F2');
  await expect(page.getByRole('heading', { name: 'Comandas', exact: true })).toBeVisible();
  for (const column of ['ESPERANDO CONFIRMAÇÃO', 'ESPERANDO PAGAMENTO', 'PAGOS / FINALIZADOS', 'FIADOS']) {
    await expect(page.getByRole('region', { name: column })).toBeVisible();
  }
  await expect(page.getByText('Nenhuma comanda nesta etapa.').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/pdv-board-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/pdv-board-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('link', { name: 'Caixa', exact: true }).click();
  await page.keyboard.press('F9');
  await expect(page.getByRole('heading', { name: 'Histórico de vendas', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Caixa', exact: true }).click();
  await page.keyboard.press('F3');
  await expect(page.getByRole('heading', { name: 'Relatório', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Receber pagamento', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Receber pagamento do cliente' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/pdv-desktop.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole('link', { name: 'Conflora - página inicial' }).first()).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole('button', { name: 'Voltar ao início da página' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ir para pagamento' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Selecionar cliente' })).toBeVisible();
  const cashierPlaceholder = await page.request.get('/store-assets/placeholder.svg');
  expect(cashierPlaceholder.status()).toBe(200);
  await page.screenshot({ path: 'test-results/pdv-mobile.png', fullPage: false });
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(page.getByText('Recibo em Tempo Real', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/pdv-tablet.png', fullPage: false });
  expect(errors).toEqual([]);
});
