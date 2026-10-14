const { chromium } = require('playwright');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let paid = false;
    const order = { id: 'sicredi_test', total: 25, ticketNumber: '123', paymentProvider: 'SICREDI', pix: { pixCopiaECola: 'test-pix', qrCodeBase64: await require('qrcode').toDataURL('test-pix') } };
    await page.route('http://pdv.test/**', async route => {
      const url = route.request().url();
      if (url.endsWith('/api/caixa/orders/sicredi_test/pix')) { return route.fulfill({ json: { order: { ...order, paymentStatus: paid ? 'PAGO' : '', paymentTransactionId: paid ? 'E1111111111111111111111111111111' : '' } } }); }
      if (url.includes('/api/')) { return route.fulfill({ json: [] }); }
      return route.fulfill({ contentType: 'text/html', body: fs.readFileSync('src/http/views-caixa.html', 'utf8') });
    });
    await page.addInitScript(() => globalThis.localStorage.setItem('conflora-pix-order', 'sicredi_test'));
    await page.goto('http://pdv.test/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.getByRole('dialog', { name: 'Pagamento Pix Sicredi' }).waitFor({ timeout: 20000 });
    await page.getByAltText('QR Code Pix da venda').waitFor();
    if (await page.getByRole('dialog', { name: 'Pagamento aprovado', exact: true }).count()) { throw new Error('Recibo prematuro'); }
    paid = true;
    await page.getByRole('button', { name: 'Verificar Pagamento Agora' }).click();
    await page.getByRole('dialog', { name: 'Pagamento aprovado', exact: true }).waitFor();
    if (!(await page.getByRole('dialog').innerText()).includes('25,00')) { throw new Error('Valor incorreto'); }
    if (errors.length) { throw new Error(errors.join('\n')); }
    console.log('UI móvel: QR, confirmação manual e recibo validados.');
    await page.setViewportSize({ width: 1440, height: 900 });
    paid = false;
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('dialog', { name: 'Pagamento Pix Sicredi' }).waitFor();
    paid = true;
    await page.getByRole('dialog', { name: 'Pagamento aprovado', exact: true }).waitFor({ timeout: 15000 });
    console.log('UI desktop: recuperação e polling automático validados.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
