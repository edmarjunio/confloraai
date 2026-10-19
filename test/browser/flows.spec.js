const { openAdminSection } = require('./admin-navigation');
const { test, expect } = require('@playwright/test');

const pageErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  pageErrors.set(page, []);
  page.on('pageerror', error => pageErrors.get(page).push(error.message));
  page.on('dialog', dialog => dialog.accept());
  // Os fluxos não dependem de analytics, fontes ou imagens hospedadas externamente.
  await page.route(/https:\/\/.*/, route => route.abort());
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

async function selectOperator(page, name, pin) {
  await page.locator('#userSelectList').getByText(name, { exact: true }).click();
  await page.locator('#loginPinInput').fill(pin);
  await page.getByRole('button', { name: /Entrar com PIN|Acessar Painel|Entrar no Painel/ }).click();
  await expect(page.locator('#loginModal')).not.toHaveClass(/open/);
}

async function pinLogin(page, name, pin) {
  await page.goto('/admin');
  await expect(page.locator('#loginModal')).toHaveClass(/open/);
  await selectOperator(page, name, pin);
}

async function selectPortuguese(page) {
  const language = page.locator('#languageSelect');
  if (await language.count()) await language.selectOption('pt');
}

test('Catálogo: pesquisa abre o produto correto', async ({ page }) => {
  await page.goto('/');
  await selectPortuguese(page);
  await expect(page.locator('#products .product-card').first()).toBeVisible();
  await page.locator('#search').fill('Planta Teste');
  await page.getByRole('button', { name: 'Planta Teste', exact: true }).click();
  await expect(page).toHaveURL(/\/products\/test-plant$/);
  await expect(page.locator('#productView h1')).toHaveText('Planta Teste');
});

test('Admin: cabeçalho, ordem das abas e navegação dos sete módulos', async ({ page }) => {
  await pinLogin(page, 'Edmar Júnio (Izibola)', '1234');
  await expect(page.locator('#loggedUserName')).toHaveText('Edmar Júnio (Izibola)');
  await expect(page.locator('#loggedUserRole')).toHaveText('ADMIN');
  await expect(page.getByRole('link', { name: /^CAIXA$/i })).toBeVisible();
  await expect(page.locator('.nav-tabs')).toHaveCount(0);
  for (const tab of ['cashier', 'orders', 'stock', 'products', 'team', 'status', 'analytics']) {
    await openAdminSection(page, tab);
    await expect(page.locator('#tab-' + tab)).toHaveClass(/active/);
  }
  await openAdminSection(page, 'products');
  await page.getByRole('button', { name: /ADICIONAR PRODUTO/ }).click();
  await expect(page.locator('#productEditorDialog')).toBeVisible();
  await expect(page.locator('#productEditorDialog #prodForm')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#productEditorDialog')).toBeHidden();
  await expect(page.locator('#tabBtn-import')).toHaveCount(0);
});

test('Caixa: operador registra venda e áreas administrativas ficam bloqueadas', async ({ page }) => {
  await pinLogin(page, 'Atendente do Caixa', '0000');
  await expect(page.locator('#loggedUserRole')).toHaveText('CAIXA');
  for (const tab of ['orders', 'stock', 'products', 'team', 'status', 'analytics']) {
    await expect(page.locator('#tabBtn-' + tab)).toBeHidden();
  }
  await page.locator('button[onclick="openManualOrderModal()"]')
    .click();
  await page.locator('#mCustName').fill('Venda E2E Caixa');
  await page.locator('#mProdSelect').selectOption({ index: 0 });
  await page.locator('#mQty').fill('1');
  await page.locator('#manualOrderModal button[type=submit]').click();
  await expect(page.locator('#manualOrderModal')).not.toHaveClass(/open/);
  const ordersResponse = await page.request.get('/api/admin/orders');
  expect(ordersResponse.ok()).toBeTruthy();
  const orders = await ordersResponse.json();
  expect(orders.some(order => order.customerName === 'Venda E2E Caixa')).toBe(true);
});

test('Vendedor: login limita o acesso às vendas e permite abrir preço', async ({ page }) => {
  await pinLogin(page, 'Edmar Júnio (Izibola)', '1234');
  await openAdminSection(page, 'team');
  await page.locator('[onclick="openNewUserModal()"]')
    .click();
  await page.locator('#uName').fill('Vendedor E2E');
  await page.locator('#uEmail').fill('seller-e2e@test.com');
  await page.locator('#uPin').fill('7788');
  await page.locator('#uRole').selectOption('VENDEDOR');
  await page.locator('#userModal button[type=submit]').click();
  await expect(page.locator('#teamTableBody')).toContainText('Vendedor E2E');

  await page.locator('button[onclick="logoutAdmin()"]')
    .click();
  await expect(page.locator('#loginModal')).toHaveClass(/open/);
  await selectOperator(page, 'Vendedor E2E', '7788');
  await expect(page.locator('#loggedUserRole')).toHaveText('VENDEDOR');
  await expect(page.locator('#tab-cashier')).toHaveClass(/active/);
  for (const tab of ['orders', 'stock', 'products', 'team', 'status', 'analytics']) {
    await expect(page.locator('#tabBtn-' + tab)).toBeHidden();
  }
  await expect(page.locator('#cashierAlterationsButton')).toBeHidden();
  await page.getByRole('button', { name: 'Consultar preços' }).click();
  await expect(page.locator('#tab-price')).toHaveClass(/active/);
});

test('Cliente: compra, recibo e detalhes do histórico usam o mesmo comprovante', async ({ page }) => {
  await page.goto('/');
  await selectPortuguese(page);
  await page.locator('#accountButton').click();
  await page.locator('#accountContent select').selectOption('register');
  await page.locator('#accountContent input[name=name]').fill('Cliente E2E');
  await page.locator('#accountContent input[name=email]').fill('browser@test.com');
  await page.locator('#accountContent input[name=password]').fill('senha123');
  await page.locator('#accountContent button[type=submit]').click();
  await expect(page.locator('#headerAccountName')).toHaveText('Cliente E2E');
  await page.locator('#search').fill('Planta Teste');
  await page.getByRole('button', { name: 'Planta Teste', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar à sacola', exact: true }).click();
  await page.locator('#cartButton').click();
  await page.locator('#checkoutCustomer input[name=name]').fill('Cliente E2E');
  await page.locator('#checkoutCustomer input[name=phone]').fill('64999999999');
  await page.locator('input[name=fulfillment][value=pickup]').check();
  await page.locator('input[name=payment][value=CASH]').check();
  await page.locator('#checkoutForm input[name=cash]').fill('100');
  await page.locator('#submitOrder').click();
  const orderRequest = page.waitForRequest(request =>
    request.url().endsWith('/api/storefront/orders') && request.method() === 'POST',
  );
  const orderResponse = page.waitForResponse(response =>
    response.url().endsWith('/api/storefront/orders') && response.request().method() === 'POST',
  );
  await page.locator('#orderReviewConfirm').click();
  await expect(page.locator('#receipt')).toBeVisible();
  const purchaseReceipt = await page.locator('#receipt .order-receipt-text').innerText();
  expect(purchaseReceipt).toContain('Cliente E2E');
  const checkoutRequest = await orderRequest;
  const checkoutResponse = await orderResponse;
  expect(checkoutResponse.ok()).toBe(true);
  const originalOrder = (await checkoutResponse.json()).order;
  const replay = await page.request.post('/api/storefront/orders', {
    data: JSON.parse(checkoutRequest.postData()),
    headers: { 'Idempotency-Key': checkoutRequest.headers()['idempotency-key'] },
  });
  expect(replay.ok()).toBe(true);
  expect((await replay.json()).order.id).toBe(originalOrder.id);
  await page.route('**/api/customer/orders**', route => route.fulfill({ json: {
    success: true,
    orders: [originalOrder],
    hasMore: false, nextCursor: null,
  } }));
  await page.locator('#cartCloseButton').click();
  await page.locator('#customerAccountShortcut').click();
  await expect(page.locator('#historyList')).toContainText('Pedido #');
  const orderDetails = page.locator('.history-order-details').first();
  await orderDetails.locator('summary').click();
  expect(await orderDetails.locator('.order-receipt-text').innerText()).toBe(purchaseReceipt);
});

test('Admin: entrada, saída com justificativa e contagem substituem saldo com imagem renderizada', async ({ page }) => {
  await pinLogin(page, 'Edmar Júnio (Izibola)', '1234');
  await openAdminSection(page, 'stock');
  await page.locator('#stockSearchInput').fill('ABACATE KG');
  await page.locator('#stockModeEntry').click();
  const card = page.locator('#stockCardsGrid .stock-card').filter({ hasText: 'ABACATE KG' });
  await expect(card).toBeVisible();
  await expect(card.locator('render-image img')).toBeVisible();
  const before = Number(await card.locator('.stock-card-balance strong').textContent());
  await card.locator('.product-photo').click();
  await expect(card.locator('.stock-count-preview')).toContainText('Entrada: +1');
  await page.locator('#stockSave').click();
  await expect(card.locator('.stock-card-balance strong')).toHaveText(String(before + 1));

  await card.getByRole('button', { name: 'Baixa ou ajuste com motivo' }).click();
  await page.locator('#stockAdjustmentQuantity').fill('1');
  await page.locator('#stockAdjustmentReason').fill('Avaria de teste');
  await page.locator('#stockAdjustmentForm button[type=submit]').click();
  await expect(card.locator('.stock-card-balance strong')).toHaveText(String(before));
  await expect(page.locator('#stockMovementsList')).toContainText('Avaria de teste');

  await page.getByRole('button', { name: '✓ Conferir o que tenho', exact: true }).click();
  await card.locator('input').fill('15');
  await card.locator('input').blur();
  await page.locator('#stockSave').click();
  await expect(card.locator('.stock-card-balance strong')).toHaveText('15');
  await expect(page.locator('#stockMovementsList')).toContainText('Conferência física');
});

test('Admin mobile: produto inativo não aparece no catálogo e estoque não causa overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await pinLogin(page, 'Edmar Júnio (Izibola)', '1234');
  const response = await page.request.post('/api/admin/products', { data: {
    id: 'inactive-filter-test', name: 'Produto oculto teste', category: 'Teste',
    price: 10, status: 'INATIVO', stockQuantity: 0,
  } });
  expect(response.ok()).toBeTruthy();
  await openAdminSection(page, 'products');
  const product = page.locator('#adminProductsGrid render-product-card').filter({ hasText: 'Produto oculto teste' });
  await expect(product).toHaveCount(0);
  await page.getByRole('button', { name: 'INATIVOS', exact: true }).click();
  await expect(product).toContainText('INATIVO - Indisponível');
  const catalog = await (await page.request.get('/api/storefront/catalog')).json();
  const inactiveCatalogProduct = catalog.products.find(item => item.id === 'inactive-filter-test');
  expect(inactiveCatalogProduct?.isAvailable).toBe(false);
  await openAdminSection(page, 'stock');
  await expect(page.locator('#stockControlEnabled')).toHaveCount(0);
  expect(await page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.request.delete('/api/admin/products/inactive-filter-test');
});

test('Login inválido mantém o painel fechado', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('#loginModal')).toHaveClass(/open/);
  await page.locator('#loginPinInput').fill('9999');
  await page.getByRole('button', { name: 'Entrar com PIN' }).click();
  await expect(page.locator('#loginModal')).toHaveClass(/open/);
  await expect(page.locator('#tabBtn-import')).toBeHidden();
  await expect(page.locator('#adminGoogleLoginButton')).toBeDisabled();
  await expect(page.locator('[data-google-status]')).not.toBeEmpty();
});

test('Admin alterna venda livre e estoque ativo sem cadastrar entrada', async ({ page }) => {
  await pinLogin(page, 'Edmar Júnio (Izibola)', '1234');
  const original = await (await page.request.get('/api/admin/inventory-settings')).json();
  await openAdminSection(page, 'stock');
  const button = page.locator('#stockControlToggle');
  await expect(button).toBeEnabled();
  try {
    if ((await button.getAttribute('aria-pressed')) === 'true') await button.click();
    await expect(button).toHaveText('Venda livre · Ativar estoque');
    await expect(page.locator('#stockControlHelp')).toContainText('Venda livre');
    await page.reload();
    await openAdminSection(page, 'stock');
    await expect(button).toHaveText('Venda livre · Ativar estoque');
    await button.click();
    await expect(button).toContainText('Estoque ativo');
    expect((await (await page.request.get('/api/admin/inventory-settings')).json()).stockControlEnabled).toBe(true);
  } finally {
    await page.request.put('/api/admin/inventory-settings', { data: original });
  }
});
