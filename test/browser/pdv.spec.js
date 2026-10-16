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
      imageUrl: '/storefront/placeholder.svg',
    }));
    await route.fulfill({ response, json: [...additions, ...existing] });
  });
  await page.goto('/pdv');
  await expect(page.getByRole('heading', { name: 'Conflora · PDV' })).toBeVisible();
  await page.getByLabel('Usuário').selectOption('usr-caixa1');
  await page.getByLabel('PIN', { exact: true }).fill('0000');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Comandas e meus números' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Escanear|Leitor de Código/i })).toHaveCount(0);
  await expect(page.getByText('Computador (2/3 + 1/3)')).toHaveCount(0);
  await expect(page.getByText('Tela 2/3 e 1/3')).toHaveCount(0);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    if (await page.getByText('Produto Carregamento 130', { exact: true }).count()) break;
    await page.waitForTimeout(150);
  }
  await expect(page.getByText('Produto Carregamento 130', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByPlaceholder('O que você procura? (Nome, código ou categoria)...').fill('Planta Teste');
  await page.getByText('Planta Teste', { exact: true }).click();
  await page.keyboard.press('F2');
  await page.getByRole('button', { name: 'Dinheiro', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar Venda', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Venda finalizada', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Pagamento confirmado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nova venda', exact: true }).click();
  await page.getByPlaceholder('O que você procura? (Nome, código ou categoria)...').fill('');
  await page.getByRole('button', { name: 'Comandas e meus números' }).click();
  await expect(page.getByRole('dialog', { name: 'Comandas e meus números' })).toBeVisible();
  for (const column of ['ESPERANDO CONFIRMAÇÃO', 'ESPERANDO PAGAMENTO', 'CONFIRMADOS', 'PAGOS / FINALIZADOS']) {
    await expect(page.getByRole('region', { name: column })).toBeVisible();
  }
  await expect(page.getByText('Nenhuma comanda nesta etapa.').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/pdv-board-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/pdv-board-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Histórico de vendas' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechamento', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Resumo para fechamento/ })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Receber dívida', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Receber dívida de fiado' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.screenshot({ path: 'test-results/pdv-desktop.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/pdv-mobile.png', fullPage: false });
  expect(errors).toEqual([]);
});
