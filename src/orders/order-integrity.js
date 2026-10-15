const PAID_ORDER_STATUSES = new Set(['PAGO', 'CONFIRMED', 'PAID_CONFIRMED', 'DELIVERED']);

/** Validate the persisted order inside the same transaction as its stock writes. */
function validateOrderConfirmation(order, updates) {
  if (order.status === 'CANCELLED') {
    throw new Error('Pedido cancelado não pode receber baixa ou confirmação.');
  }
  if (!updates || String(order.paymentMethod).toUpperCase() !== 'PIX') {return;}
  if (PAID_ORDER_STATUSES.has(order.status) && order.paymentTransactionId) {return;}
  if (
    updates.verifiedVia !== 'MERCADO_PAGO_WEBHOOK' ||
    !/^\d+$/.test(updates.paymentTransactionId || '') ||
    !Number.isFinite(Number(updates.paymentVerifiedAmount)) ||
    Number(order.total) <= 0 ||
    Math.round(Number(updates.paymentVerifiedAmount) * 100) !== Math.round(Number(order.total) * 100)
  ) {
    throw new Error('Confirmação PIX exige pagamento verificado com o valor do pedido.');
  }
}

function validateStockQuantity(item) {
  const quantity = Number(item.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quantidade inválida para baixa de estoque.');
  }
  return quantity;
}

function remainingStock(product, quantity) {
  const stock = Number(product.stockQuantity ?? product.estoque ?? 0);
  if (!Number.isFinite(stock) || stock < quantity) {
    throw new Error(`Estoque insuficiente para ${product.name || 'produto'}.`);
  }
  return stock - quantity;
}

module.exports = { PAID_ORDER_STATUSES, validateOrderConfirmation, validateStockQuantity, remainingStock };
