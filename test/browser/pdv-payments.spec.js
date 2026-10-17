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
  await page.getByRole('button', { name: 'Pix · QR Code / Copia e Cola', exact: true }).click();
  await page.getByLabel('Somente criar comanda e encaminhar ao caixa (inclusive Pix)').check();
  const result = page.waitForResponse((response) => response.url().endsWith('/api/caixa/orders') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Enviar comanda ao caixa', exact: true }).click();
  const { order } = await (await result).json();
  expect(order.status).toBe('AWAITING_PAYMENT');
  expect(order.pixData).toBeNull();
  await expect(page.getByRole('dialog', { name: 'Pedido registrado', exact: true })).toBeVisible();
});

test('quadro permite apenas avançar etapas e abre recebimento ao arrastar para pagos', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  expect((await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } })).ok()).toBe(true);
  const creation = await page.request.post('/api/caixa/orders', { data: { requestId: require('node:crypto').randomUUID(), items: [{ productId: 'test-plant', quantity: 1 }], paymentMethod: 'DINHEIRO', deferToCashier: true, customerName: 'Arrastar Teste' } });
  expect(creation.ok()).toBe(true); const { order } = await creation.json();
  await page.goto('/pdv'); await expect(page.getByPlaceholder('Nome, categoria ou descrição (Ex.: plantas de sombra, plantas para jardim, flores, e etc)')).toBeVisible(); await page.keyboard.press('F2');
  const payment = page.getByRole('region', { name: 'ESPERANDO PAGAMENTO', exact: true });
  const paid = page.getByRole('region', { name: 'PAGOS / FINALIZADOS', exact: true });
  const card = (region) => region.locator('cf-card').filter({ hasText: 'Arrastar Teste' });
  await expect(card(payment)).toHaveAttribute('draggable', 'true');
  const dialog = page.getByRole('dialog', { name: `Comanda #${order.ticketNumber}` });
  await expect(card(payment)).toHaveCSS('background-color', 'rgb(189, 221, 255)');
  await card(payment).dragTo(paid.locator('header'));
  await expect(dialog.getByRole('heading', { name: 'Receber no caixa' })).toBeVisible();
  await dialog.getByLabel('Usar mais de uma forma de pagamento').check();
  await dialog.getByLabel('Valor da parcela 1').fill('10'); await dialog.getByLabel('Valor da parcela 2').fill('15');
  await dialog.getByRole('button', { name: 'Confirmar pagamento e finalizar', exact: true }).click();
  await expect(dialog).toContainText('Pago / finalizado');
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(card(paid)).toHaveCSS('background-color', 'rgb(184, 235, 207)');
  await expect(card(paid)).not.toHaveAttribute('draggable', 'true');
});

test('caixa recebe dívida parcialmente e quita o restante com Pix conferido', async ({ page }) => {
  expect((await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } })).ok()).toBe(true);
  const customerResponse = await page.request.post('/api/caixa/customers', { data: { name: 'Cliente Parcelado E2E' } });
  const { customer } = await customerResponse.json();
  const creditResponse = await page.request.post('/api/caixa/orders', { data: { requestId: require('node:crypto').randomUUID(), items: [{ productId: 'test-plant', quantity: 8 }], paymentMethod: 'FIADO', customerId: customer.id } });
  expect(creditResponse.ok()).toBe(true); const creditOrder = (await creditResponse.json()).order;
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } });
  expect((await page.request.post(`/api/caixa/orders/${creditOrder.id}/confirm`, { data: { paymentMethod: 'FIADO' } })).ok()).toBe(true);
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } });
  await page.goto('/pdv'); await expect(page.getByPlaceholder('Nome, categoria ou descrição (Ex.: plantas de sombra, plantas para jardim, flores, e etc)')).toBeVisible(); await page.keyboard.press('F3');
  await page.getByRole('button', { name: 'Receber pagamento', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Receber pagamento do cliente', exact: true });
  await dialog.getByLabel('Buscar cliente cadastrado').fill('Cliente Parcelado E2E');
  await dialog.getByRole('button', { name: /Cliente Parcelado E2E/ }).click();
  await dialog.getByLabel('Valor recebido', { exact: true }).fill('100');
  await dialog.getByRole('button', { name: 'Confirmar recebimento', exact: true }).click();
  await expect(dialog).toContainText('Saldo devedor: R$ 100,00');
  await dialog.getByRole('button', { name: 'Receber valor restante', exact: true }).click();
  await dialog.getByRole('button', { name: 'Pix já recebido', exact: true }).click();
  await dialog.getByLabel('Foto ou PDF do comprovante Pix (obrigatório)').setInputFiles({ name: 'comprovante.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nComprovante de teste\n%%EOF') });
  await expect(dialog).toContainText('Comprovante anexado: comprovante.pdf');
  await dialog.getByRole('checkbox', { name: /Conferi o Pix recebido/ }).check();
  await dialog.getByLabel('Observação do comprovante').fill('Pix verificado na conta recebedora');
  await dialog.getByRole('button', { name: 'Confirmar recebimento', exact: true }).click();
  await expect(dialog).toContainText('Saldo devedor: R$ 0,00');
});

test('entrega abre identificação, busca após quatro letras e preenche o cliente selecionado', async ({ page }) => {
  expect((await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } })).ok()).toBe(true);
  expect((await page.request.post('/api/caixa/customers', { data: { name: 'Mariana Busca Teste', phone: '64988881234', address: 'Rua das Flores, 10, Centro, Mineiros GO' } })).ok()).toBe(true);
  await page.goto('/pdv');
  await expect(page.getByRole('button', { name: '🛵 Entrega', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '🛵 Entrega', exact: true }).click();
  const customer = page.getByRole('dialog', { name: 'Identificar cliente', exact: true });
  await expect(customer).toBeVisible();
  await customer.getByLabel('Nome do Cliente', { exact: true }).fill('Nova cliente');
  await customer.getByRole('button', { name: 'Adicionar cliente', exact: true }).click();
  await expect(customer).toContainText('Para entrega, informe nome, WhatsApp');
  let searches = 0; page.on('request', (request) => { if (request.url().includes('/api/caixa/customers?q=')) searches++; });
  await customer.getByRole('button', { name: 'BUSCAR CLIENTE', exact: true }).click();
  const search = page.getByRole('dialog', { name: 'Buscar cliente', exact: true });
  await search.getByLabel('Nome do cliente', { exact: true }).fill('Mar');
  await page.waitForTimeout(450); expect(searches).toBe(0);
  await search.getByLabel('Nome do cliente', { exact: true }).fill('Mariana');
  await search.getByRole('button', { name: /Mariana Busca Teste/ }).click();
  await expect(search).toBeHidden();
  await expect(customer.getByLabel('Nome do Cliente', { exact: true })).toHaveValue('Mariana Busca Teste');
  await expect(customer.getByLabel('Telefone / WhatsApp', { exact: true })).toHaveValue('5564988881234');
  await expect(customer.getByLabel('Endereço de entrega', { exact: true })).toHaveValue('Rua das Flores, 10, Centro, Mineiros GO');
  await expect(customer.getByRole('button', { name: 'Selecionar cliente', exact: true })).toBeVisible();
  await customer.getByRole('button', { name: 'Selecionar cliente', exact: true }).click();
  await expect(customer).toBeHidden();
  await expect(page.getByText('Mariana Busca Teste', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Selecionar cliente', exact: true }).first().click();
  await expect(customer).toBeVisible(); await page.mouse.click(2, 2); await expect(customer).toBeHidden();
});

test('comanda recebe por botões e Pix manual exige arquivo antes de finalizar', async ({ page }) => {
  expect((await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } })).ok()).toBe(true);
  const response = await page.request.post('/api/caixa/orders', { data: { requestId: require('node:crypto').randomUUID(), items: [{ productId: 'test-plant', quantity: 1 }], paymentMethod: 'DINHEIRO', deferToCashier: true, customerName: 'Comprovante Obrigatório' } });
  expect(response.ok()).toBe(true); const { order } = await response.json();
  await page.goto('/pdv'); await expect(page.getByPlaceholder('Nome, categoria ou descrição (Ex.: plantas de sombra, plantas para jardim, flores, e etc)')).toBeVisible(); await page.keyboard.press('F2');
  const open = page.getByRole('region', { name: 'ESPERANDO PAGAMENTO', exact: true }).getByRole('button').filter({ hasText: 'Comprovante Obrigatório' });
  await open.click(); const dialog = page.getByRole('dialog', { name: `Comanda #${order.ticketNumber}` });
  await expect(dialog.getByRole('combobox')).toHaveCount(0);
  await page.mouse.click(2, 2); await expect(dialog).toBeHidden(); await open.click();
  await dialog.getByRole('button', { name: 'Pix · QR Code / Copia e Cola', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'Pix já recebido: confirmar manualmente', exact: true }).check();
  await dialog.getByRole('checkbox', { name: /Conferi o valor do Pix/ }).check();
  await dialog.getByLabel('Observação do comprovante').fill('Comprovante conferido na conta');
  const finish = dialog.getByRole('button', { name: 'Confirmar pagamento e finalizar', exact: true });
  await expect(finish).toBeDisabled();
  await dialog.getByLabel('Foto ou PDF do comprovante Pix (obrigatório)').setInputFiles({ name: 'pix.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nComprovante de teste\n%%EOF') });
  await expect(dialog).toContainText('Comprovante anexado: pix.pdf');
  await expect(finish).toBeEnabled(); await finish.click();
  await expect(dialog).toContainText('Pago / finalizado');
  await expect(dialog.getByRole('link', { name: 'Ver comprovante Pix anexado', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/payment-proof-finished.png' });
});


test('seller completes own direct Pix with mandatory proof and no cash receiving controls', async ({ page }) => {
  expect((await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } })).ok()).toBe(true);
  const userId = 'seller-pix-' + Date.now();
  expect((await page.request.post('/api/admin/users', { data: { id: userId, name: 'Vendedor Pix', role: 'VENDEDOR', pin: '7788', active: true } })).ok()).toBe(true);
  expect((await page.request.post('/api/admin/auth/login', { data: { userId, pin: '7788' } })).ok()).toBe(true);
  const response = await page.request.post('/api/caixa/orders', { data: { requestId: require('node:crypto').randomUUID(), items: [{ productId: 'test-plant', quantity: 1 }], paymentMethod: 'DINHEIRO', deferToCashier: true, customerName: 'Pix do Vendedor' } });
  expect(response.ok()).toBe(true);
  const { order } = await response.json();
  await page.goto('/pdv');
  await expect(page.getByPlaceholder('Nome, categoria ou descrição (Ex.: plantas de sombra, plantas para jardim, flores, e etc)')).toBeVisible();
  await page.keyboard.press('F2');
  await page.getByRole('button', { name: 'Abrir recibo e detalhes da comanda ' + order.ticketNumber }).click();
  const dialog = page.getByRole('dialog', { name: `Comanda #${order.ticketNumber}` });
  await expect(dialog.getByRole('button', { name: '💵 Dinheiro', exact: true })).toHaveCount(0);
  const finish = dialog.getByRole('button', { name: 'Confirmar Pix manualmente e finalizar', exact: true });
  await expect(finish).toBeDisabled();
  await dialog.getByRole('checkbox', { name: /Conferi no comprovante o valor exato de R\$\s*25,00/ }).check();
  await dialog.getByLabel('Observação do comprovante').fill('Valor conferido na conta da loja');
  await dialog.getByLabel('Foto ou PDF do comprovante Pix (obrigatório)').setInputFiles({ name: 'pix.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nTeste\n%%EOF') });
  await expect(finish).toBeEnabled();
  await finish.click();
  await expect(dialog).toContainText('Pago / finalizado');
  await expect(dialog.getByRole('link', { name: 'Ver comprovante Pix anexado', exact: true })).toBeVisible();
});
