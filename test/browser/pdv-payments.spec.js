const { test, expect } = require('@playwright/test');

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
