const { test, expect } = require('@playwright/test');

test('conferência manual de pagamento dividido mostra apenas o valor da parcela Pix', async ({ page }) => {
  const login = await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } });
  expect(login.ok()).toBe(true);
  await page.route((url) => url.pathname === '/api/caixa/orders', async (route) => {
    const response = await route.fetch();
    const board = await response.json();
    board.pendingPayment = [{
      id: 'manual-mixed-pix', ticketNumber: 'PIXPARCELA', customerName: 'Cliente Pix dividido',
      source: 'PDV', status: 'AWAITING_PIX', paymentMethod: 'PIX', paymentStatus: 'PENDING',
      total: 25, subtotal: 25, createdAt: new Date().toISOString(),
      createdBy: { id: 'usr-caixa1', name: 'Caixa Teste' },
      paymentParts: [{ method: 'DINHEIRO', amount: 10 }, { method: 'PIX', amount: 15 }],
      items: [{ productId: 'test-plant', name: 'Planta Teste', quantity: 1, price: 25 }],
    }];
    await route.fulfill({ response, json: board });
  });
  await page.goto('/pdv');
  await expect(page.getByPlaceholder('Nome, categoria ou descrição (Ex.: plantas de sombra, plantas para jardim, flores, e etc)')).toBeVisible();
  await page.keyboard.press('F2');
  await page.getByRole('region', { name: 'ESPERANDO PAGAMENTO' }).getByRole('button').filter({ hasText: 'Cliente Pix dividido' }).click();
  await expect(page.getByRole('checkbox', { name: /Conferi no comprovante o valor exato de R\$\s*15,00/ })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Conferi no comprovante o valor exato de R\$\s*25,00/ })).toHaveCount(0);
});

test('caixa divide pagamento e pode encaminhar uma comanda Pix sem emitir cobrança', async ({ page }) => {
  const login = await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } });
  expect(login.ok()).toBe(true);
  await page.goto('/pdv');
  const search = page.getByPlaceholder('Nome, categoria ou descrição (Ex.: plantas de sombra, plantas para jardim, flores, e etc)');
  await search.fill('Planta Teste');
  await page.getByText('Planta Teste', { exact: true }).click();
  await page.getByRole('button', { name: /PAGAR - F1/ }).click();
  await page.getByLabel('Usar mais de uma forma de pagamento').check();
  await page.getByLabel('Valor da parcela 1').fill('10');
  await page.getByLabel('Valor da parcela 2').fill('15');
  await page.screenshot({ path: 'test-results/split-payment.png' });
  await page.getByRole('button', { name: 'Confirmar pagamentos', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Venda finalizada', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nova venda', exact: true }).click();
  await search.fill('Planta Teste');
  await page.getByText('Planta Teste', { exact: true }).click();
  await page.getByRole('button', { name: /PAGAR - F1/ }).click();
  await page.getByRole('button', { name: 'PIX Sicredi', exact: true }).click();
  await page.getByLabel('Somente criar comanda e encaminhar ao caixa (inclusive Pix)').check();
  const result = page.waitForResponse((response) => response.url().endsWith('/api/caixa/orders') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Enviar comanda ao caixa', exact: true }).click();
  const { order } = await (await result).json();
  expect(order.status).toBe('AWAITING_CASHIER');
  expect(order.pixData).toBeNull();
  await expect(page.getByRole('dialog', { name: 'Pedido registrado', exact: true })).toBeVisible();
});
