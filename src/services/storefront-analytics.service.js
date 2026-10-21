const { getBusinessDate } = require('../reports/daily-executive-metrics');
const { paymentFacts } = require('../reports/payment-facts');

// Campaigns are controlled labels, never URLs, email addresses or arbitrary search text.
function campaignLabel(value) {
  const text = String(value || '');
  return /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(text) && !/\d{7}/.test(text) ? text : '';
}

class StorefrontAnalyticsService {
  constructor(repository, { env = process.env, now = Date.now, report = null } = {}) {
    this.repository = repository;
    this.env = env;
    this.now = now;
    this.report = report || (body => this.runReport(body));
    this.cache = new Map();
    this.pending = new Map();
  }
  configured() { return /^\d+$/.test(this.env.GA4_PROPERTY_ID || ''); }
  primary() { return this.env.STOREFRONT_ANALYTICS_MODE === 'ga4' && this.env.GA4_REPORTS_VALIDATED === 'true' && this.configured(); }
  async runReport(body) {
    if (process.env.NODE_ENV === 'test') throw new Error('GA4 real requests disabled in tests');
    // ADC or workload identity only. No token, key or service account is sent to the browser.
    this.auth ||= new (require('google-auth-library').GoogleAuth)({ scopes: ['https://www.googleapis.com/auth/analytics.readonly'] });
    const client = await this.auth.getClient();
    const result = await client.request({
      url: `https://analyticsdata.googleapis.com/v1beta/properties/${this.env.GA4_PROPERTY_ID}:runReport`,
      method: 'POST', data: body, timeout: 8000, retry: false,
    });
    return result.data;
  }
  async navigation(days) {
    const cached = this.cache.get(days);
    if (cached?.until > this.now()) return cached.value;
    if (this.pending.has(days)) return this.pending.get(days);
    if (this.blockedUntil > this.now()) throw new Error('GA4 temporarily unavailable');
    const work = (async () => {
      const base = { dateRanges: [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }], limit: '100' };
      const [events, users, products, campaigns] = await Promise.all([
        this.report({ ...base, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }] }),
        this.report({ ...base, metrics: [{ name: 'totalUsers' }] }),
        this.report({ ...base, dimensions: [{ name: 'itemId' }], metrics: [{ name: 'itemsViewed' }, { name: 'itemsAddedToCart' }], orderBys: [{ metric: { metricName: 'itemsViewed' }, desc: true }], limit: '10' }),
        this.report({ ...base, dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'sessionCampaignName' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: '10' }),
      ]);
      const counts = Object.fromEntries((events.rows || []).map(row => [row.dimensionValues[0].value, Number(row.metricValues[0].value) || 0]));
      const value = {
        eventCounts: counts, visitors: Number(users.rows?.[0]?.metricValues?.[0]?.value) || 0,
        productViews: counts.view_item || 0, addToCart: counts.add_to_cart || 0, checkoutStarts: counts.begin_checkout || 0,
        topProducts: (products.rows || []).map(row => ({ productId: row.dimensionValues[0].value, name: row.dimensionValues[0].value, views: Number(row.metricValues[0].value) || 0, adds: Number(row.metricValues[1].value) || 0, purchases: 0 })),
        campaigns: (campaigns.rows || []).map(row => ({ name: row.dimensionValues.map(v => v.value).join(' / '), visits: Number(row.metricValues[0].value) || 0, purchases: 0, revenue: 0 })),
        navigationSource: 'GA4', collectedEvents: Object.values(counts).reduce((sum, count) => sum + count, 0),
      };
      this.cache.set(days, { until: this.now() + 60000, value });
      return value;
    })();
    this.pending.set(days, work);
    try { return await work; }
    catch (error) { this.blockedUntil = this.now() + 60000; throw error; }
    finally { this.pending.delete(days); }
  }
  async record(event) {
    if (event.eventName === 'purchase') return { success: true, ignored: true };
    if (this.primary()) {
      try { await this.navigation(30); return { success: true, source: 'GA4' }; }
      catch { /* Keep collecting when the replacement report is unavailable. */ }
    }
    return this.repository.recordStorefrontEvent(event);
  }
  async legacyNavigation(days) {
    const key = `legacy:${days}`;
    const cached = this.cache.get(key);
    if (cached?.until > this.now()) return cached.value;
    if (this.pending.has(key)) return this.pending.get(key);
    const work = this.repository.getStorefrontAnalyticsSummary({ days }).then(value => {
      this.cache.set(key, { until: this.now() + 60000, value });
      return value;
    });
    this.pending.set(key, work);
    try { return await work; } finally { this.pending.delete(key); }
  }
  async summary({ days = 30 } = {}) {
    const range = Math.max(1, Math.min(90, Math.floor(Number(days) || 30)));
    const key = `summary:${range}`;
    if (this.pending.has(key)) return this.pending.get(key);
    // Coalesce overlapping reports only; no financial snapshot survives completion.
    const work = this.buildSummary(range).finally(() => this.pending.delete(key));
    this.pending.set(key, work);
    return work;
  }
  async buildSummary(range) {
    let navigation;
    if (this.primary()) {
      try { navigation = await this.navigation(range); } catch { /* Fallback is explicitly marked below. */ }
    }
    navigation ||= { ...await this.legacyNavigation(range), navigationSource: 'FIRESTORE',
      ...(this.primary() ? { warning: 'GA4_UNAVAILABLE_FALLBACK' } : {}) };
    const from = getBusinessDate(new Date(this.now() - (range - 1) * 86400000));
    const to = getBusinessDate(new Date(this.now()));
    const snapshots = await Promise.all(['createdAt', 'paidAt', 'completedAt'].map(field => this.repository.getExecutiveRecordsForRange('orders', from, to, field)));
    const orders = [...new Map(snapshots.flat().filter(order => order.source === 'WEB_CATALOG').map(order => [order.id, order])).values()];
    const facts = paymentFacts(orders).filter(fact => fact.date >= from && fact.date <= to);
    const paid = orders.filter(order => order.status !== 'CANCELLED' && ['APPROVED', 'PAID', 'PAID_CONFIRMED'].includes(order.paymentStatus) && order.paidAt && getBusinessDate(order.paidAt) >= from && getBusinessDate(order.paidAt) <= to);
    const purchased = new Map();
    for (const order of paid) for (const item of order.items || []) purchased.set(item.productId, (purchased.get(item.productId) || 0) + Number(item.quantity || 0));
    return {
      ...navigation, days: range, since: from, financialSource: 'FIRESTORE_CONFIRMED_PAYMENTS',
      purchases: paid.length, revenue: facts.reduce((sum, fact) => sum + fact.amountMinor, 0) / 100,
      conversionRate: navigation.visitors ? paid.length / navigation.visitors * 100 : 0,
      conversionBasis: 'PAID_ORDERS_PER_VISITOR', attributedFinancialsUnavailable: true,
      eventCounts: { ...navigation.eventCounts, purchase: paid.length },
      topProducts: navigation.topProducts.map(row => ({ ...row, purchases: purchased.get(row.productId) || 0 })),
      // Browser-submitted historical purchases cannot establish financial attribution.
      campaigns: navigation.campaigns.map(row => ({ ...row, purchases: 0, revenue: 0 })),
    };
  }
}

module.exports = { StorefrontAnalyticsService, campaignLabel };
