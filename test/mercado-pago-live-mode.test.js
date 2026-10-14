const test = require('node:test');
const assert = require('node:assert/strict');
const { MercadoPagoClient, isApprovedPixPayment } = require('../src/integrations/mercado-pago.client');
const order = { id: 'dev-real-pix', total: 1 };

test('checkout accepts the documented preference response without a payment live_mode field', async () => {
    const client = new MercadoPagoClient({ accessToken: 'mock-token',
      fetchImpl: async () => ({ ok: true, json: async () => ({ id: 'pref',
        init_point: 'https://www.mercadopago.com.br/checkout/test' }) }) });
    const create = () => client.createPixCheckout({ order, notificationUrl: 'https://confloraai-dev.web.app/webhooks/mercadopago' });
    assert.equal((await create()).id, 'pref');
});
test('a simulated payment cannot confirm an order configured for real Pix', () => {
  const payment = { status: 'approved', payment_method_id: 'pix', currency_id: 'BRL',
    external_reference: order.id, transaction_amount: 1,
    date_created: '2026-10-14T10:00:00Z', date_approved: '2026-10-14T10:01:00Z' };
  assert.equal(isApprovedPixPayment({ ...payment, live_mode: false }, order, { expectedLiveMode: true }), false);
  assert.equal(isApprovedPixPayment(payment, order, { expectedLiveMode: true }), false);
  assert.equal(isApprovedPixPayment({ ...payment, live_mode: true }, order, { expectedLiveMode: true }), true);
  assert.equal(isApprovedPixPayment(payment, order, { expectedLiveMode: null }), true);
});
