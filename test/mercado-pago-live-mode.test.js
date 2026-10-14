const test = require('node:test');
const assert = require('node:assert/strict');
const { MercadoPagoClient, isApprovedPixPayment } = require('../src/integrations/mercado-pago.client');
const order = { id: 'dev-real-pix', total: 1 };

for (const liveMode of [false, undefined, true]) {
  test(`real Pix checkout requires live_mode=true (received ${liveMode})`, async () => {
    const client = new MercadoPagoClient({ accessToken: 'mock-token', expectedLiveMode: true,
      fetchImpl: async () => ({ ok: true, json: async () => ({ id: 'pref', live_mode: liveMode,
        init_point: 'https://www.mercadopago.com.br/checkout/test' }) }) });
    const create = () => client.createPixCheckout({ order, notificationUrl: 'https://confloraai-dev.web.app/webhooks/mercadopago' });
    if (liveMode === true) assert.equal((await create()).id, 'pref');
    else await assert.rejects(create, /modo do checkout/);
  });
}
test('a simulated payment cannot confirm an order configured for real Pix', () => {
  const payment = { status: 'approved', payment_method_id: 'pix', currency_id: 'BRL',
    external_reference: order.id, transaction_amount: 1,
    date_created: '2026-10-14T10:00:00Z', date_approved: '2026-10-14T10:01:00Z' };
  assert.equal(isApprovedPixPayment({ ...payment, live_mode: false }, order, { expectedLiveMode: true }), false);
  assert.equal(isApprovedPixPayment(payment, order, { expectedLiveMode: true }), false);
  assert.equal(isApprovedPixPayment({ ...payment, live_mode: true }, order, { expectedLiveMode: true }), true);
  assert.equal(isApprovedPixPayment(payment, order, { expectedLiveMode: null }), true);
});
