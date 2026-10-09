const { normalizeText } = require('../shared/string.util');

const SALES_STATUSES = new Set([
  'CONFIRMED', 'DELIVERED', 'CONFIRMED_AWAITING_PAYMENT',
  'CONFIRMED_AWAITING_DELIVERY', 'PAID_CONFIRMED',
]);

/** Sum units from confirmed orders, matching legacy items by an unambiguous name. */
function rankProductSales(products, orders) {
  const byId = new Map(products.map(product => [String(product.id), 0]));
  const byName = new Map();
  for (const product of products) {
    const name = normalizeText(product.descricao || product.name);
    byName.set(name, byName.has(name) ? null : String(product.id));
  }
  for (const order of orders) {
    if (!SALES_STATUSES.has(order.status) || !Array.isArray(order.items)) {
      continue;
    }
    for (const item of order.items) {
      if (!item) { continue; }
      const id = item.productId ?? item.id;
      const key = id === null || id === undefined ? byName.get(normalizeText(item.name)) : String(id);
      const quantity = Number(item.quantity);
      if (!byId.has(key) || !Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }
      byId.set(key, byId.get(key) + quantity);
    }
  }
  return products.map(product => ({ ...product, salesCount: byId.get(String(product.id)) }));
}

module.exports = { rankProductSales };
