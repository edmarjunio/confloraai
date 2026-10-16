const PAID_ORDER_STATUSES = new Set(['CONFIRMED', 'PAID_CONFIRMED', 'DELIVERED']);

/** Validate the persisted order inside the same transaction as its stock writes. */
function validateOrderConfirmation(order, updates) {
  if (order.status === 'CANCELLED') {
    throw new Error('Pedido cancelado não pode receber baixa ou confirmação.');
  }
  if (!updates || String(order.paymentMethod).toUpperCase() !== 'PIX') {return;}
  if (PAID_ORDER_STATUSES.has(order.status) && order.paymentTransactionId) {return;}
  const paidAmountMatches = Number.isFinite(Number(updates.paymentVerifiedAmount)) &&
    Number(order.total) > 0 &&
    Math.round(Number(updates.paymentVerifiedAmount) * 100) === Math.round(Number(order.total) * 100);
  const sicrediVerified = updates.verifiedVia === 'SICREDI_PIX_WEBHOOK' &&
    updates.pixTxid === order.pixData?.txid && /^E[a-zA-Z0-9]{31}$/.test(updates.paymentTransactionId || '') && paidAmountMatches;
  const manualPixVerified = updates.verifiedVia === 'MANUAL_CAIXA_PIX' &&
    updates.manualPixProofSeen === true && Boolean(updates.manualPixConfirmedBy?.id) &&
    ['ADMIN', 'CAIXA'].includes(updates.manualPixConfirmedBy?.role) &&
    String(updates.manualPixNote || '').trim().length >= 8 && paidAmountMatches;
  const mercadoPagoVerified = updates.verifiedVia === 'MERCADO_PAGO_WEBHOOK' &&
    /^\d+$/.test(updates.paymentTransactionId || '') && paidAmountMatches;
  if (!sicrediVerified && !manualPixVerified && !mercadoPagoVerified) {
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
  const nextStock = stock - quantity;
  const savedUnit = String(product.saleUnit?.code || product.unit || product.unidade || '').trim().toUpperCase();
  const unit = savedUnit || (/(^|[^A-Z])KG([^A-Z]|$)/i.test(String(product.name || product.descricao || '')) ? 'KG' : 'UN');
  return unit === 'KG' ? Number(nextStock.toFixed(3)) : nextStock;
}

module.exports = { PAID_ORDER_STATUSES, validateOrderConfirmation, validateStockQuantity, remainingStock };
