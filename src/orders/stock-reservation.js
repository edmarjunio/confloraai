const { validateStockQuantity } = require('./order-integrity');

async function prepareStockReservation(tx, items) {
  const settings = await tx.get('store_settings', 'inventory');
  const enabled = settings?.stockControlEnabled ?? process.env.STORE_STOCK_CONTROL_ENABLED !== 'false';
  if (!enabled) return { products: [], reservedItems: [], trackingDisabled: true };
  const quantities = new Map();
  for (const item of items || []) {
    const productId = String(item.productId || '');
    if (!productId) throw new Error(`Produto sem identificador para reservar: ${item.name || 'item'}.`);
    quantities.set(productId, Number(((quantities.get(productId) || 0) + validateStockQuantity(item)).toFixed(3)));
  }
  const products = [];
  for (const [productId, quantity] of quantities) {
    const product = await tx.get('products', productId);
    if (!product) throw new Error(`Produto não encontrado para reservar: ${productId}.`);
    const stock = Number(product.stockQuantity ?? product.estoque ?? 0);
    const reserved = Number(product.reservedQuantity || 0);
    if (!Number.isFinite(stock) || !Number.isFinite(reserved) || stock - reserved < quantity) {
      throw new Error(`Estoque disponível insuficiente para ${product.name || productId}.`);
    }
    products.push({ productId, product, reservedQuantity: Number((reserved + quantity).toFixed(3)) });
  }
  return { products, reservedItems: [...quantities].map(([productId, quantity]) => ({ productId, quantity })) };
}

function applyStockReservation(tx, reservation, updatedAt) {
  for (const { productId, product, reservedQuantity } of reservation.products) {
    tx.set('products', productId, { ...product, reservedQuantity, updatedAt });
  }
}

module.exports = { prepareStockReservation, applyStockReservation };
