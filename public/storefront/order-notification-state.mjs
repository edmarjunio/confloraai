export function customerOrderStatus(order) {
  if (/CANCEL|REJECT|EXPIRED/.test(String(order.status || '').toUpperCase())) return 'Pedido cancelado';
  const delivery = String(order.deliveryStatus || order.status || '').toUpperCase();
  if (['DELIVERED', 'ENTREGUE'].includes(delivery)) return 'Pedido entregue';
  if (delivery === 'OUT_FOR_DELIVERY') return 'Em rota de entrega';
  if (['PREPARING_DELIVERY', 'PREPARING'].includes(delivery)) return 'Pedido em preparação';
  if (['READY', 'READY_FOR_PICKUP'].includes(delivery)) return 'Pedido pronto para retirada';
  if (order.paidAt || ['APPROVED', 'PAID', 'ON_ACCOUNT'].includes(order.paymentStatus)) return 'Pedido confirmado';
  return 'Pedido recebido';
}

// The first snapshot is a baseline; reconnects and stage changes never replay arrivals.
export function createOrderTracker(mode = 'customer') {
  const seen = new Map();
  let initialized = false;
  function observe(orders, { announce = false } = {}) {
    const changes = [];
    for (const order of orders) {
      if (!order?.id) continue;
      const status = customerOrderStatus(order);
      const previous = seen.get(String(order.id));
      seen.set(String(order.id), status);
      if (announce || (initialized && (mode === 'cashier' ? previous === undefined : previous !== status))) changes.push({ order, status });
    }
    initialized = true;
    while (seen.size > 1000) seen.delete(seen.keys().next().value);
    return changes;
  }
  function remember(order) { if (order?.id) seen.set(String(order.id), customerOrderStatus(order)); }
  return { observe, remember };
}
