const { ensureCashierSession } = require('./cashier-session');
const { test, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
let server;
const base = 'http://127.0.0.1:8100';
test.beforeAll(async () => {
  server = spawn(process.execPath, ['test/browser-server.js'], { cwd: resolve(__dirname, '../..'), env: { ...process.env, PIX_MODE: 'MANUAL', BROWSER_TEST_PORT: '8100', WHATSAPP_TOKEN: '', WHATSAPP_PHONE_NUMBER_ID: '' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(new Error('Servidor de Pix manual não iniciou.')), 20000);
    server.stdout.on('data', chunk => { if (chunk.toString().includes('Browser test server: 8100')) { clearTimeout(timeout); done(); } });
    server.once('exit', () => { clearTimeout(timeout); reject(new Error('Servidor isolado encerrou antes de iniciar.')); });
  });
});
test.afterAll(() => server?.kill());

test('cliente envia comprovante na página do pedido e Admin confere o Pix sem Sicredi', async ({ page }) => {
  const response = await page.request.post(base + '/api/storefront/orders', { headers: { 'Idempotency-Key': require('node:crypto').randomUUID() }, data: { customer: { name: 'Cliente revisão manual', phone: '64999990000' }, fulfillment: 'pickup', paymentMethod: 'PIX', items: [{ productId: 'test-plant', quantity: 1 }] } });
  expect(response.ok()).toBe(true); const { order } = await response.json();
  await page.goto(base + '/#' + new URLSearchParams({ pedido: order.id, acesso: order.accessToken }));
  const tracking = page.getByRole('dialog', { name: 'Acompanhar pedido' });
  await expect(tracking.getByRole('button', { name: 'Copiar chave Pix', exact: true })).toBeVisible();
  await expect(tracking).not.toContainText('Sicredi');
  await tracking.getByLabel('Comprovante do pagamento Pix').setInputFiles({ name: 'comprovante.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nComprovante de teste\n%%EOF') });
  await tracking.getByRole('button', { name: 'Enviar comprovante', exact: true }).click();
  await expect(tracking.getByRole('status')).toContainText('aguardando conferência');
  await page.screenshot({ path: 'test-results/manual-pix-customer.png', fullPage: true });
  await page.request.post(base + '/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } });
  await page.goto(base + '/caixa');
  await page.getByLabel('Usuário').selectOption('usr-edmar');
  await page.getByLabel('PIN', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await ensureCashierSession(page);
  expect(await page.evaluate(() => window.CONFLORA_PIX_MODE)).toBe('MANUAL');
  await expect(page.getByRole('button', { name: /F2.*Comandas/ })).toBeVisible();
  await page.getByRole('button', { name: /F2.*Comandas/ }).click();
  await page.getByRole('button', { name: 'Abrir recibo e detalhes da comanda ' + order.ticketNumber, exact: true }).click();
  const review = page.getByRole('dialog', { name: /^Comanda #/ });
  await expect(review.getByRole('button', { name: 'Ver comprovante enviado pelo cliente', exact: true })).toBeVisible();
  await review.getByLabel('Conferi o recebimento na conta bancária e o valor da parcela Pix.').check();
  await review.getByLabel('Observação ou motivo').fill('Valor e beneficiário conferidos na conta bancária.');
  await page.screenshot({ path: 'test-results/manual-pix-review.png', fullPage: true });
  await review.getByRole('button', { name: 'Confirmar recebimento Pix', exact: true }).click();
  await expect.poll(async () => {
    const updated = await page.request.get(base + `/api/storefront/orders/${order.id}/payment`, { headers: { 'X-Order-Token': order.accessToken } });
    return (await updated.json()).order.paymentReviewStatus;
  }).toBe('APPROVED');
});

test('nome cadastrado pelo cliente é exibido como texto na equipe, sem executar HTML', async ({ page }) => {
  await page.request.post(base + '/api/auth/register', { data: { name: '<img src=x onerror="document.body.dataset.reviewXss=1">', email: 'browser-review@example.test', password: 'review-pass-123' } });
  await page.request.post(base + '/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } });
  await page.goto(base + '/admin?tab=team');
  await expect(page.locator('#teamTableBody')).toContainText('<img src=x');
  expect(await page.evaluate(() => document.body.dataset.reviewXss)).toBeUndefined();
});
