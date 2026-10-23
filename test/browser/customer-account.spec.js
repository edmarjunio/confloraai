const { test, expect } = require('@playwright/test');

test('Minha conta unifica saldo, fiados, pagamentos e compras para o cliente logado', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { id: 'customer-account', name: 'Cliente Conta', email: 'conta@test.com', role: 'CLIENTE' } } }));
  await page.route('**/api/customer/ledger', (route) => route.fulfill({ json: {
    success: true, customerName: 'Cliente Conta', balance: 75, creditBalance: 10,
    transactions: [
      { id: 'debt', type: 'DEBITO_FIADO', amount: 100, createdAt: '2026-10-15T12:00:00Z', ticketNumber: '123', items: [{ name: 'Muda', quantity: 2, unit: 'UN' }], receiptText: 'Recibo da compra fiada' },
      { id: 'settle', type: 'QUITACAO_FIADO', amount: 25, newBalance: 75, paymentMethod: 'DINHEIRO', receivedBy: 'Caixa', createdAt: '2026-10-16T12:00:00Z' },
    ],
  } }));
  await page.route('**/api/customer/orders**', (route) => route.fulfill({ json: { success: true, orders: [{ id: 'paid-order', ticketNumber: '456', total: 20, paymentMethod: 'PIX', status: 'CONFIRMED', paidAt: '2026-10-16T12:00:00Z', createdAt: '2026-10-15T12:00:00Z', items: [{ name: 'Alface', quantity: 2, price: 10 }], receiptText: 'Recibo pago' }], hasMore: false } }));
  await page.goto('/');
  await expect(page.locator('#customerAccountShortcut')).toBeVisible();
  await expect(page.locator('#cashierShortcut')).toBeHidden();
  await expect(page.locator('#historyButton')).toHaveCount(0);
  await page.locator('#customerAccountShortcut').click();
  const account = page.getByRole('dialog', { name: 'Minha conta', exact: true });
  await expect(account).toBeVisible();
  await expect(account).toContainText('Saldo devedor');
  await expect(account).toContainText('75,00');
  await expect(account).toContainText('Crédito a seu favor');
  await expect(account).toContainText('Compra fiada');
  await expect(account).toContainText('Recebimento de fiado');
  await expect(account).toContainText('Pedido #456');
  await account.locator('.history-order-details summary').click();
  await expect(account).toContainText('Pago em:');
  await page.screenshot({ path: 'test-results/customer-account-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/customer-account-mobile.png' });
});

test('Minha conta não aparece para visitante; equipe mantém o atalho do caixa', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#accountButton')).toBeVisible();
  await expect(page.locator('#customerAccountShortcut')).toBeHidden();
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { id: 'cashier', name: 'Caixa', role: 'CAIXA' } } }));
  await page.reload();
  await expect(page.locator('#cashierShortcut')).toBeVisible();
  await expect(page.locator('#customerAccountShortcut')).toBeHidden();
});

test('cliente vê dívida no cabeçalho e paga Pix sem contato com o caixa', async ({ page }) => {
  let paid = false;
  await page.route('**/api/storefront/catalog', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.config.checkout.pix.mode = 'SICREDI';
    await route.fulfill({ response, json: data });
  });
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { id: 'debt-client', name: 'Cliente', email: 'client@test.com', role: 'CLIENTE' } } }));
  await page.route('**/api/customer/ledger', (route) => route.fulfill({ json: { success: true, balance: paid ? 0 : 20, creditBalance: 0, customerName: 'Cliente', supportPhone: '5564999994321', transactions: [] } }));
  await page.route('**/api/customer/orders**', (route) => route.fulfill({ json: { success: true, orders: [], hasMore: false } }));
  await page.route('**/api/customer/debt-pix', (route) => {
    const input = route.request().postDataJSON();
    expect(input.amount).toBe(20);
    return route.fulfill({ json: { success: true, charge: { id: input.requestId, amount: 20, status: 'AWAITING_PIX', pixData: { pixCopiaECola: 'pix-debt-code', qrCodeBase64: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=' } } } });
  });
  await page.route('**/api/customer/debt-pix/*', (route) => route.fulfill({ json: { success: true, charge: { status: paid ? 'PAID' : 'AWAITING_PIX' } } }));
  await page.goto('/');
  await expect(page.locator('#customerDebtBadge')).toContainText('20,00');
  await page.locator('#customerAccountShortcut').click();
  await expect(page.getByRole('link', { name: 'Falar com a loja', exact: true })).toHaveAttribute('href', /wa.me\/5564999994321/);
  await page.getByRole('button', { name: 'Pagar dívida com Pix', exact: true }).click();
  await expect(page.getByRole('img', { name: 'QR Code Pix para pagamento da dívida' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Pix copia e cola da dívida' })).toHaveValue('pix-debt-code');
  await page.getByRole('img', { name: 'QR Code Pix para pagamento da dívida' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/debt-payment-pix.png' });
  paid = true;
  await expect(page.locator('#ledgerContent')).toContainText('Pagamento confirmado!', { timeout: 10000 });
  await expect(page.locator('#customerDebtBadge')).toBeHidden();
});
