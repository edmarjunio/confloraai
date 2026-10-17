function isDelivery(order) {
  return order?.orderType === 'DELIVERY' || order?.fulfillment === 'delivery';
}
function isDeliverySettled(order) {
  return Boolean(order?.completedAt && ['APPROVED', 'ON_ACCOUNT'].includes(order.paymentStatus));
}
function assertAssignedDelivery(order, actor) {
  if (!isDelivery(order) || order.status === 'CANCELLED' || order.deliveryStatus !== 'OUT_FOR_DELIVERY' ||
      (actor?.role !== 'ADMIN' && order.assignedDriver?.id !== actor?.id)) {
    throw new Error('Aceite esta entrega e registre a saída da horta antes de receber ou concluir. Apenas o responsável pode alterar a entrega.');
  }
}
function canReceiveOrder(order, actor) {
  if (['ADMIN', 'CAIXA'].includes(actor?.role)) return true;
  if (actor?.role !== 'ENTREGADOR') return false;
  try { assertAssignedDelivery(order, actor); return true; } catch { return false; }
}
function financialReceiver(order) {
  return order?.receivedBy?.role === 'ENTREGADOR'
    ? order.createdBy || { id: 'ONLINE', name: 'Catálogo online', role: 'SYSTEM' }
    : order?.receivedBy;
}
module.exports = { financialReceiver, isDelivery, isDeliverySettled, assertAssignedDelivery, canReceiveOrder };
