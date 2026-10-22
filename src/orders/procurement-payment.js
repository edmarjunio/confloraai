/** Only the unpaid balance is collected at pickup/delivery. The sale total remains unchanged. */
function payableTotal(order) {
  const total = Math.round(Number(order?.total || 0) * 100);
  const deposit = Number(order?.procurement?.deposit?.amountMinor || 0);
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(deposit) || deposit < 0 || deposit > total) throw new Error('Saldo da encomenda inválido.');
  return (total - deposit) / 100;
}

function assertProcurementReady(order) {
  if (!order?.procurement) return;
  if (!order.procurement.acceptedAt || !order.procurement.deposit?.receivedAt || !order.procurement.arrivedAt || !order.procurement.fulfillmentConfirmedAt) {
    throw new Error('Confirme o aceite, o sinal, a chegada e a entrega/retirada na aba Encomendas antes de receber o restante.');
  }
}

function procurementOrder(request) {
  return { id: request.id, ticketNumber: request.id.slice(-8).toUpperCase(), source: 'WHATSAPP_BOT',
    procurementRequestId: request.id, procurement: { stage: 'AWAITING_QUOTE', depositRequiredMinor: null },
    items: request.items.map(item => ({ ...item, name: item.requestedName, price: null })),
    customerId: request.customerId || '', customerEmail: request.customerEmail || '', customerName: request.customerName, customerPhone: request.customerPhone,
    orderType: 'PICKUP', total: null, subtotal: null, freightValue: 0, discountAmount: 0, discountPercent: 0,
    paymentMethod: 'DINHEIRO', paymentParts: [], paymentStatus: 'PENDING', status: 'AWAITING_QUOTE',
    createdBy: { id: 'WHATSAPP_BOT', name: 'Atendimento Conflora', role: 'SYSTEM' },
    createdAt: request.createdAt, updatedAt: request.updatedAt };
}

module.exports = { payableTotal, assertProcurementReady, procurementOrder };
