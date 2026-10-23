export function customerOrderStatus(order) {
  if (/CANCEL|REJECT|EXPIRED/.test(String(order.status || '').toUpperCase())) return 'order_cancelled'.tr;
  const delivery = String(order.deliveryStatus || order.status || '').toUpperCase();
  if (['DELIVERED', 'ENTREGUE'].includes(delivery)) return 'order_delivered'.tr;
  if (delivery === 'OUT_FOR_DELIVERY') return 'out_for_delivery_3af3c5'.tr;
  if (['PREPARING_DELIVERY', 'PREPARING'].includes(delivery)) return 'order_being_prepared'.tr;
  if (['READY', 'READY_FOR_PICKUP'].includes(delivery)) return 'order_ready_for_pickup'.tr;
  if (order.paidAt || ['APPROVED', 'PAID', 'ON_ACCOUNT'].includes(order.paymentStatus)) return 'order_confirmed'.tr;
  return 'order_received'.tr;
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
