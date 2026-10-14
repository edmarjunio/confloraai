[35msrc/http/app.js[m[36m:[m[32m23[m[36m:[mconst { [1;31mMercadoPago[mClient, isApprovedPixPayment } = require('../integrations/[1;31mmercado-pago[m.client');
[35msrc/http/app.js[m[36m:[m[32m872[m[36m:[mfunction [1;31mmercadoPago[mNotificationUrl() {
[35msrc/http/app.js[m[36m:[m[32m875[m[36m:[m    throw new Error('Configure SERVICE_URL com a URL HTTPS pública para os [1;31mwebhook[ms do Mercado Pago.');
[35msrc/http/app.js[m[36m:[m[32m877[m[36m:[m  return new URL('/[1;31mwebhook[ms/[1;31mmercadopago[m', baseUrl).toString();
[35msrc/http/app.js[m[36m:[m[32m917[m[36m:[m  [1;31mmercadoPago[mClient,
[35msrc/http/app.js[m[36m:[m[32m922[m[36m:[m    [1;31mmercadoPago[mClient ||
[35msrc/http/app.js[m[36m:[m[32m923[m[36m:[m    new [1;31mMercadoPago[mClient({
[35msrc/http/app.js[m[36m:[m[32m924[m[36m:[m      accessToken: config.[1;31mmercadoPago[m.accessToken,
[35msrc/http/app.js[m[36m:[m[32m925[m[36m:[m      [1;31mwebhook[mSecret: config.[1;31mmercadoPago[m.[1;31mwebhook[mSecret,
[35msrc/http/app.js[m[36m:[m[32m927[m[36m:[m  messageService.[1;31mmercadoPago[mClient = payments;
[35msrc/http/app.js[m[36m:[m[32m1079[m[36m:[m      [1;31mpaymentProvider[m: 'MERCADO_PAGO',
[35msrc/http/app.js[m[36m:[m[32m1080[m[36m:[m      expectedLiveMode: config.[1;31mmercadoPago[m.expectedLiveMode,
[35msrc/http/app.js[m[36m:[m[32m1102[m[36m:[m  // Meta [1;31mWebhook[m Verification (GET)
[35msrc/http/app.js[m[36m:[m[32m1103[m[36m:[m  app.get('/[1;31mwebhook[m', (req, res) => {
[35msrc/http/app.js[m[36m:[m[32m1109[m[36m:[m      Logger.info('Meta [1;31mWebhook[m verificado com sucesso.');
[35msrc/http/app.js[m[36m:[m[32m1113[m[36m:[m    Logger.warn('Tentativa de verificação do [1;31mWebhook[m com token inválido.');
[35msrc/http/app.js[m[36m:[m[32m1117[m[36m:[m  // Meta [1;31mWebhook[m Event Receiver (POST)
[35msrc/http/app.js[m[36m:[m[32m1118[m[36m:[m  app.post('/[1;31mwebhook[m', async (req, res) => {
[35msrc/http/app.js[m[36m:[m[32m1122[m[36m:[m      Logger.warn('Assinatura do [1;31mwebhook[m inválida.');
[35msrc/http/app.js[m[36m:[m[32m1152[m[36m:[m          systemStatusService.record[1;31mWebhook[mHit(phone);
[35msrc/http/app.js[m[36m:[m[32m1182[m[36m:[m  app.post('/[1;31mwebhook[ms/[1;31mmercadopago[m', async (req, res) => {
[35msrc/http/app.js[m[36m:[m[32m1184[m[36m:[m    const signatureIsValid = payments.verify[1;31mWebhook[mSignature({
[35msrc/http/app.js[m[36m:[m[32m1190[m[36m:[m      Logger.warn('[1;31mWebhook[m do Mercado Pago recusado: assinatura inválida.');
[35msrc/http/app.js[m[36m:[m[32m1240[m[36m:[m            verifiedVia: 'MERCADO_PAGO_[1;31mWEBHOOK[m',
[35msrc/http/app.js[m[36m:[m[32m1470[m[36m:[m      let [1;31mmercadoPago[mPreference = null;
[35msrc/http/app.js[m[36m:[m[32m1474[m[36m:[m            error: 'Pagamento PIX indisponível. Configure as credenciais e o segredo de [1;31mwebhook[m do Mercado Pago.',
[35msrc/http/app.js[m[36m:[m[32m1477[m[36m:[m        [1;31mmercadoPago[mPreference = await payments.createPixCheckout({
[35msrc/http/app.js[m[36m:[m[32m1480[m[36m:[m          notificationUrl: [1;31mmercadoPago[mNotificationUrl(),
[35msrc/http/app.js[m[36m:[m[32m1502[m[36m:[m        [1;31mmercadoPago[mPreferenceId: [1;31mmercadoPago[mPreference?.id || '',
[35msrc/http/app.js[m[36m:[m[32m1503[m[36m:[m        paymentCheckoutUrl: [1;31mmercadoPago[mPreference?.checkoutUrl || '',
[35msrc/http/app.js[m[36m:[m[32m1578[m[36m:[m          paymentCheckoutUrl: [1;31mmercadoPago[mPreference?.checkoutUrl || '',
[35msrc/http/app.js[m[36m:[m[32m1670[m[36m:[m      let [1;31mmercadoPago[mPreference = null;
[35msrc/http/app.js[m[36m:[m[32m1674[m[36m:[m            error: 'Pagamento PIX indisponível. Configure as credenciais e o segredo de [1;31mwebhook[m do Mercado Pago.',
[35msrc/http/app.js[m[36m:[m[32m1681[m[36m:[m        [1;31mmercadoPago[mPreference = await payments.createPixCheckout({
[35msrc/http/app.js[m[36m:[m[32m1683[m[36m:[m          notificationUrl: [1;31mmercadoPago[mNotificationUrl(),
[35msrc/http/app.js[m[36m:[m[32m1694[m[36m:[m        [1;31mmercadoPago[mPreferenceId: [1;31mmercadoPago[mPreference?.id || '',
[35msrc/http/app.js[m[36m:[m[32m1695[m[36m:[m        paymentCheckoutUrl: [1;31mmercadoPago[mPreference?.checkoutUrl || '',
[35msrc/http/app.js[m[36m:[m[32m1857[m[36m:[m      let [1;31mmercadoPago[mPreference = null;
[35msrc/http/app.js[m[36m:[m[32m1861[m[36m:[m            error: 'Pagamento PIX indisponível. Configure as credenciais e o segredo de [1;31mwebhook[m do Mercado Pago.',
[35msrc/http/app.js[m[36m:[m[32m1864[m[36m:[m        [1;31mmercadoPago[mPreference = await payments.createPixCheckout({
[35msrc/http/app.js[m[36m:[m[32m1866[m[36m:[m          notificationUrl: [1;31mmercadoPago[mNotificationUrl(),
[35msrc/http/app.js[m[36m:[m[32m1881[m[36m:[m        [1;31mmercadoPago[mPreferenceId: [1;31mmercadoPago[mPreference?.id || '',
[35msrc/http/app.js[m[36m:[m[32m1882[m[36m:[m        paymentCheckoutUrl: [1;31mmercadoPago[mPreference?.checkoutUrl || '',
[35msrc/http/app.js[m[36m:[m[32m1910[m[36m:[m          paymentCheckoutUrl: [1;31mmercadoPago[mPreference?.checkoutUrl || '',
[35msrc/http/app.js[m[36m:[m[32m2297[m[36m:[m  app.post('/api/admin/test-[1;31mwebhook[m', async (_req, res) => {
[35msrc/http/app.js[m[36m:[m[32m2555[m[36m:[m      let [1;31mmercadoPago[mPreference = null;
[35msrc/http/app.js[m[36m:[m[32m2559[m[36m:[m            error: 'Pagamento PIX indisponível. Configure as credenciais e o segredo de [1;31mwebhook[m do Mercado Pago.',
[35msrc/http/app.js[m[36m:[m[32m2562[m[36m:[m        [1;31mmercadoPago[mPreference = await payments.createPixCheckout({
[35msrc/http/app.js[m[36m:[m[32m2564[m[36m:[m          notificationUrl: [1;31mmercadoPago[mNotificationUrl(),
[35msrc/http/app.js[m[36m:[m[32m2574[m[36m:[m        [1;31mmercadoPago[mPreferenceId: [1;31mmercadoPago[mPreference?.id || '',
[35msrc/http/app.js[m[36m:[m[32m2575[m[36m:[m        paymentCheckoutUrl: [1;31mmercadoPago[mPreference?.checkoutUrl || '',
