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

test('quadro permite apenas avançar etapas e abre recebimento ao arrastar para pagos', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  expect((await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } })).ok()).toBe(true);
  const creation = await page.request.post('/api/caixa/orders', { data: { requestId: require('node:crypto').randomUUID(), items: [{ productId: 'test-plant', quantity: 1 }], paymentMethod: 'DINHEIRO', deferToCashier: true, customerName: 'Arrastar Teste' } });
  expect(creation.ok()).toBe(true); const { order } = await creation.json();
  await page.goto('/pdv'); await expect(page.getByPlaceholder('Nome, categoria ou descrição (Ex.: plantas de sombra, plantas para jardim, flores, e etc)')).toBeVisible(); await page.keyboard.press('F2');
  const confirmation = page.getByRole('region', { name: 'ESPERANDO CONFIRMAÇÃO', exact: true });
  const payment = page.getByRole('region', { name: 'ESPERANDO PAGAMENTO', exact: true });
  const paid = page.getByRole('region', { name: 'PAGOS / FINALIZADOS', exact: true });
  const card = (region) => region.locator('cf-card').filter({ hasText: 'Arrastar Teste' });
  await expect(card(confirmation)).toHaveAttribute('draggable', 'true');
  await expect(card(confirmation)).toHaveCSS('background-color', 'rgba(254, 225, 104, 0.38)');
  await card(confirmation).dragTo(payment.locator('header'));
  const dialog = page.getByRole('dialog', { name: `Comanda #${order.ticketNumber}` });
  await expect(dialog.getByRole('heading', { name: 'Receber no caixa' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(card(payment)).toHaveCSS('background-color', 'rgba(125, 211, 252, 0.3)');
  await card(payment).dragTo(paid.locator('header'));
  await expect(dialog.getByRole('heading', { name: 'Receber no caixa' })).toBeVisible();
  await dialog.getByLabel('Usar mais de uma forma de pagamento').check();
  await dialog.getByLabel('Valor da parcela 1').fill('10'); await dialog.getByLabel('Valor da parcela 2').fill('15');
  await dialog.getByRole('button', { name: 'Confirmar pagamento e finalizar', exact: true }).click();
  await expect(dialog).toContainText('Pago / finalizado');
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(card(paid)).toHaveCSS('background-color', 'rgba(110, 231, 183, 0.3)');
  await expect(card(paid)).not.toHaveAttribute('draggable', 'true');
});

test('caixa recebe dívida parcialmente e quita o restante com Pix conferido', async ({ page }) => {
  expect((await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } })).ok()).toBe(true);
  const customerResponse = await page.request.post('/api/caixa/customers', { data: { name: 'Cliente Parcelado E2E' } });
  const { customer } = await customerResponse.json();
  expect((await page.request.post('/api/caixa/orders', { data: { requestId: require('node:crypto').randomUUID(), items: [{ productId: 'test-plant', quantity: 8 }], paymentMethod: 'FIADO', customerId: customer.id } })).ok()).toBe(true);
  await page.goto('/pdv'); await expect(page.getByPlaceholder('Nome, categoria ou descrição (Ex.: plantas de sombra, plantas para jardim, flores, e etc)')).toBeVisible(); await page.keyboard.press('F3');
  await page.getByRole('button', { name: 'Receber pagamento', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Receber pagamento do cliente', exact: true });
  await dialog.getByLabel('Buscar cliente cadastrado').fill('Cliente Parcelado E2E');
  await dialog.getByRole('button', { name: /Cliente Parcelado E2E/ }).click();
  await dialog.getByLabel('Valor recebido', { exact: true }).fill('100');
  await dialog.getByRole('button', { name: 'Confirmar recebimento', exact: true }).click();
  await expect(dialog).toContainText('Saldo devedor: R$ 100,00');
  await dialog.getByRole('button', { name: 'Receber valor restante', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Forma de recebimento', exact: true }).selectOption('PIX');
  await dialog.getByRole('checkbox', { name: /Conferi o Pix recebido/ }).check();
  await dialog.getByLabel('Observação do comprovante').fill('Pix verificado na conta recebedora');
  await dialog.getByRole('button', { name: 'Confirmar recebimento', exact: true }).click();
  await expect(dialog).toContainText('Saldo devedor: R$ 0,00');
});
