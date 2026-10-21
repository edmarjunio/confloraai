function enabled(env = process.env) {
  return env.GA4_PURCHASE_EXPORT_ENABLED === 'true' && env.GA4_REPORTS_VALIDATED === 'true' &&
    /^G-[A-Z0-9]+$/.test(env.GA4_MEASUREMENT_ID || '') && Boolean(env.GA4_API_SECRET);
}
class Ga4PurchaseClient {
  constructor({ env = process.env, request = fetch } = {}) { this.env = env; this.request = request; }
  async send(order) {
    if (process.env.NODE_ENV === 'test' && this.request === fetch) throw Object.assign(new Error('GA4 real requests disabled in tests'), { definitelyNotSent: true });
    if (!enabled(this.env) || order?.source !== 'WEB_CATALOG' || !order.paidAt ||
      !['APPROVED', 'PAID', 'PAID_CONFIRMED'].includes(order.paymentStatus) || order.status === 'CANCELLED' ||
      !/^[a-f0-9-]{36}$/.test(order.analyticsClientId || '')) {
      throw Object.assign(new Error('GA4 export is disabled or payment is not confirmed'), { definitelyNotSent: true });
    }
    const payload = {
      client_id: order.analyticsClientId,
      events: [{ name: 'purchase', params: {
        transaction_id: order.id, event_id: `purchase_${order.id}`, currency: 'BRL', value: Number(order.total),
        items: (order.items || []).map(item => ({ item_id: String(item.productId), price: Number(item.price), quantity: Number(item.quantity) })),
      } }],
    };
    if (!Number.isFinite(payload.events[0].params.value) || payload.events[0].params.value < 0 ||
      !payload.events[0].params.items.length || payload.events[0].params.items.length > 150 ||
      payload.events[0].params.items.some(item => !item.item_id || !Number.isFinite(item.price) || item.price < 0 || !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      throw Object.assign(new Error('GA4 purchase payload is invalid'), { definitelyNotSent: true });
    }
    const url = new URL('https://www.google-analytics.com/mp/collect');
    url.searchParams.set('measurement_id', this.env.GA4_MEASUREMENT_ID);
    url.searchParams.set('api_secret', this.env.GA4_API_SECRET);
    const response = await this.request(url.toString(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw Object.assign(new Error(`GA4 collection HTTP ${response.status}`), { definitelyNotSent: response.status >= 400 && response.status < 500 });
    // A 2xx acknowledges transport, not semantic validation. Validate in DebugView before enabling.
    return { accepted: true };
  }
}
module.exports = { Ga4PurchaseClient, ga4PurchaseEnabled: enabled };
