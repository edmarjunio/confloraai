const { getBusinessDate } = require('./daily-executive-metrics');
const minor = value => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : 0;
const quantityOf = item => Number(item.quantity ?? 1);
const lineMinor = item => Number.isFinite(Number(item.subtotalMinor)) ? Math.round(Number(item.subtotalMinor)) : minor(Number(item.price ?? item.unitPrice ?? 0) * quantityOf(item));
const unitOf = product => /^(KG|KILO|QUILOGRAMA)$/i.test(product.saleUnit || product.unit || '') ? 'kg' : 'un.';
const compareName = (left, right) => left.name.localeCompare(right.name, 'pt-BR');

function rankProducts(products) {
  const list = [...products.values()].map(product => ({ ...product, quantity: Math.round(product.quantity * 1000) / 1000, revenue: product.revenueMinor / 100 }));
  return {
    mostByQuantity: list.filter(item => item.quantity > 0).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || compareName(a, b)).slice(0, 10),
    mostByRevenue: list.filter(item => item.quantity > 0).sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity || compareName(a, b)).slice(0, 10),
    leastByQuantity: list.slice().sort((a, b) => a.quantity - b.quantity || a.revenue - b.revenue || compareName(a, b)).slice(0, 10),
    leastByRevenue: list.slice().sort((a, b) => a.revenue - b.revenue || a.quantity - b.quantity || compareName(a, b)).slice(0, 10),
    unsoldCount: list.filter(item => item.quantity === 0).length,
  };
}

function summarizeProductSales({ orders, catalog = [] }) {
  const definitions = new Map(catalog.map(product => [String(product.id), product]));
  const products = new Map();
  const months = new Map();
  const emptyProduct = (id, item) => {
    const definition = definitions.get(id) || {};
    return { id, name: String(item.name || definition.name || 'Produto'), unit: unitOf({ ...definition, ...item }), category: String(item.category || definition.category || 'Outros'), quantity: 0, revenueMinor: 0 };
  };
  for (const product of catalog) {
    if (product.active === false || ['INATIVO', 'INACTIVE', 'ARCHIVED'].includes(String(product.status || '').toUpperCase())) continue;
    products.set(String(product.id), emptyProduct(String(product.id), product));
  }
  for (const order of orders) {
    const key = getBusinessDate(order.createdAt).slice(0, 7);
    const month = months.get(key) || { month: key, salesMinor: 0, orderCount: 0, products: new Map() };
    month.salesMinor += minor(order.total); month.orderCount++;
    const items = (order.items || []).filter(item => Number.isFinite(quantityOf(item)) && quantityOf(item) > 0);
    const grossMinor = items.reduce((sum, item) => sum + lineMinor(item), 0);
    const netMinor = order.discountAmount !== undefined && order.discountAmount !== null ? Math.max(0, grossMinor - minor(order.discountAmount)) : order.total !== undefined && order.total !== null ? Math.max(0, minor(order.total) - minor(order.freightValue)) : grossMinor;
    let allocatedMinor = 0;
    let cumulativeGrossMinor = 0;
    items.forEach((item, index) => {
      const id = String(item.productId || item.id || item.name || '').trim();
      cumulativeGrossMinor += lineMinor(item);
      const revenueMinor = index === items.length - 1 ? netMinor - allocatedMinor : grossMinor ? Math.round(cumulativeGrossMinor / grossMinor * netMinor) - allocatedMinor : 0;
      allocatedMinor += revenueMinor;
      if (!id) return;
      for (const collection of [products, month.products]) {
        const product = collection.get(id) || emptyProduct(id, item);
        product.quantity += quantityOf(item); product.revenueMinor += revenueMinor; collection.set(id, product);
      }
    });
    months.set(key, month);
  }
  return {
    rankings: rankProducts(products),
    monthly: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map(month => ({ month: month.month, sales: month.salesMinor / 100, orderCount: month.orderCount, rankings: rankProducts(month.products) })),
  };
}

module.exports = { summarizeProductSales };
