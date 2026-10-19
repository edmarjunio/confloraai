const { getBusinessDate } = require('./daily-executive-metrics');
const completed = new Set(['CONFIRMED', 'PAID_CONFIRMED', 'DELIVERED', 'COMPLETED']);
function paymentFacts(orders, dateOf = getBusinessDate) {
  const facts = [];
  for (const order of orders) {
    if (order.status === 'CANCELLED') continue;
    for (const part of order.paymentParts || [{ method: order.paymentMethod, amount: order.total }]) {
      if (['FIADO', 'SALDO_CLIENTE'].includes(part.method)) continue;
      const status = part.status || (completed.has(order.status) && order.paymentStatus !== 'PENDING' ? 'APPROVED' : order.paymentStatus);
      if (!['APPROVED', 'PAID', 'PAID_CONFIRMED', 'RECEIVED_AT_CASHIER'].includes(status)) continue;
      const date = dateOf(part.receivedAt || (status === 'RECEIVED_AT_CASHIER' ? order.createdAt : order.paidAt || order.completedAt || order.createdAt));
      const amountMinor = Math.round(Number(part.amount || 0) * 100);
      if (!date || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) continue;
      facts.push({ date, amountMinor, method: part.method, receiver: part.receivedBy || order.receivedBy || order.createdBy, order });
    }
  }
  return facts;
}
module.exports = { paymentFacts };
