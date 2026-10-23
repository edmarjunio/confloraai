const zone = 'America/Sao_Paulo';
const monthKey = (date) => new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit' }).format(date);

// Pending checkouts are not purchases. Fiado is a purchase, even before settlement.
export function isPurchase(order) {
  const status = String(order.status || '').toUpperCase();
  const payment = String(order.paymentStatus || '').toUpperCase();
  if (/CANCEL|REFUND|REJECT|EXPIRED|ESTORN/.test(`${status} ${payment}`)) return false;
  return Boolean(order.paidAt || ['PAID', 'PAGO', 'ON_ACCOUNT'].includes(payment)
    || ['CONFIRMED', 'CONFIRMADO', 'CONFIRMED_AWAITING_PAYMENT', 'CONFIRMED_AWAITING_DELIVERY', 'PAID_CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'ENTREGUE', 'COMPLETED', 'FINALIZADO'].includes(status));
}

export function summarizePurchases(orders, now = new Date(), products = []) {
  const normalizeName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const names = new Map();
  for (const product of products) {
    const name = normalizeName(product.name);
    names.set(name, names.has(name) ? null : String(product.id));
  }
  const [year, month] = monthKey(now).split('-').map(Number);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 6 + index, 15, 12));
    return { key: monthKey(date), label: new Intl.DateTimeFormat('pt-BR', { timeZone: zone, month: 'short', year: '2-digit' }).format(date), amountMinor: 0 };
  });
  const quantities = new Map();
  const seen = new Set();
  for (const order of orders) {
    if ((order.id && seen.has(order.id)) || !isPurchase(order)) continue;
    if (order.id) seen.add(order.id);
    const date = new Date(order.createdAt);
    if (Number.isFinite(date.getTime()) && date <= now) {
      const bucket = months.find((entry) => entry.key === monthKey(date));
      const total = Number.isFinite(order.totalMinor) ? order.totalMinor : Math.round(Number(order.total || 0) * 100);
      if (bucket && Number.isFinite(total)) bucket.amountMinor += Math.max(0, total);
    }
    for (const item of order.items || []) {
      if (!item) continue;
      const id = String(item.productId ?? item.id ?? names.get(normalizeName(item.name)) ?? '');
      const quantity = Number(item.quantity);
      if (id && Number.isFinite(quantity) && quantity > 0) quantities.set(id, (quantities.get(id) || 0) + quantity);
    }
  }
  return { months, quantities };
}

// One in-flight request per account; never persist a customer's history in shared storage.
export function createPurchaseInsights(state) {
  let cache;
  let revision = 0;
  function invalidate() { revision++; cache = undefined; }
  async function load() {
    const owner = state.user?.id;
    if (!owner) return summarizePurchases([]);
    if (cache?.owner === owner && Date.now() - cache.time < 60000) return cache.promise;
    const version = ++revision;
    const promise = (async () => {
      const orders = [];
      if (!state.existingStore) orders.push(...await state.api('/orders'));
      else {
        let cursor = '';
        const cursors = new Set();
        do {
          const query = new URLSearchParams({ limit: '30' });
          if (cursor) query.set('cursor', cursor);
          const page = await state.api(`/customer/orders?${query}`);
          if (state.user?.id !== owner || revision !== version) throw new Error('account_changed'.tr);
          orders.push(...(page.orders || []));
          if (!page.hasMore) break;
          cursor = page.nextCursor;
          if (!cursor || cursors.has(cursor)) throw new Error('could_not_load_the_full_history_please_try_again'.tr);
          cursors.add(cursor);
        } while (cursor);
      }
      if (state.user?.id !== owner || revision !== version) throw new Error('account_changed'.tr);
      return summarizePurchases(orders, new Date(), state.products);
    })();
    cache = { owner, time: Date.now(), promise };
    try { return await promise; } catch (error) { if (revision === version) cache = undefined; throw error; }
  }
  return { load, invalidate };
}
