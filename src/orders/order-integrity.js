const PAID_ORDER_STATUSES = new Set(['CONFIRMED', 'PAID_CONFIRMED', 'DELIVERED']);

/** Validate the persisted order inside the same transaction as its stock writes. */
function validateOrderConfirmation(order, updates) {
  if (order.status === 'CANCELLED') {
    throw new Error('Pedido cancelado não pode receber baixa ou confirmação.');
  }
  if (!updates || String(order.paymentMethod).toUpperCase() !== 'PIX') {return;}
  if (PAID_ORDER_STATUSES.has(order.status) && order.paymentTransactionId) {return;}
  const totalMinor = Math.round(Number(order.total) * 100);
  const amountMinor = Math.round(Number(updates.paymentVerifiedAmount ?? updates.paymentAmount) * 100);
  const sicrediVerified = updates.verifiedVia === 'SICREDI_PIX_WEBHOOK'
    && updates.pixTxid === order.pixData?.txid
    && /^E[a-zA-Z0-9]{31}$/.test(updates.paymentTransactionId || '');
  const manualVerified = updates.verifiedVia === 'CAIXA_PIX_MANUAL'
    && updates.pixTxid === order.pixData?.txid
    && /^MANUAL-[a-f0-9-]{36}$/i.test(updates.paymentTransactionId || '')
    && ['ADMIN', 'CAIXA'].includes(updates.receivedBy?.role)
    && String(updates.manualProofNote || '').trim().length >= 5;
  const mercadoPagoVerified = updates.verifiedVia === 'MERCADO_PAGO_WEBHOOK'
    && /^\d+$/.test(updates.paymentTransactionId || '');
  if (
    (!sicrediVerified && !manualVerified && !mercadoPagoVerified) ||
    !Number.isFinite(amountMinor) ||
    totalMinor <= 0 ||
    amountMinor !== totalMinor
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
  const nextStock = stock - quantity;
  const savedUnit = String(product.saleUnit?.code || product.unit || product.unidade || '').trim().toUpperCase();
  const unit = savedUnit || (/(^|[^A-Z])KG([^A-Z]|$)/i.test(String(product.name || product.descricao || '')) ? 'KG' : 'UN');
  return unit === 'KG' ? Number(nextStock.toFixed(3)) : nextStock;
}

function availableStock(product) {
  const stock = Number(product?.stockQuantity ?? product?.estoque ?? 0);
  const reserved = Number(product?.reservedQuantity || 0);
  if (!Number.isFinite(stock) || !Number.isFinite(reserved)) return 0;
  return Math.max(0, stock - reserved);
}

module.exports = { PAID_ORDER_STATUSES, validateOrderConfirmation, validateStockQuantity, remainingStock, availableStock };
