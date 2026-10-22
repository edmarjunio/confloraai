import { createOrderTracker, customerOrderStatus } from './order-notification-state.mjs';
import { permissionButton, notificationSupport, showBrowserNotification } from './browser-notifications.js';

export function createCustomerOrderNotifications(state, onDetails) {
  let owner;
  let version = 0;
  let timer;
  let loadingVersion;
  let stream;
  let streamConnected = false;
  let tracker = createOrderTracker();
  function schedule() { window.clearTimeout(timer); timer = window.setTimeout(poll, document.visibilityState === 'hidden' ? 60000 : 30000); }
  function announce(changes, currentVersion) {
    for (const { order, status } of changes) showBrowserNotification({
      title: status, body: `Pedido #${order.ticketNumber || String(order.id).slice(-8).toUpperCase()} · Conflora`,
      tag: `customer:${owner}:${order.id}`, url: `${state.basePath || '/'}?order=${encodeURIComponent(order.id)}`,
      onClick: () => onDetails(order.id), allowed: () => currentVersion === version && owner === state.user?.id,
    });
  }
  async function poll() {
    const currentVersion = version;
    if (!owner || loadingVersion === currentVersion || !notificationSupport() || window.Notification.permission !== 'granted') return;
    loadingVersion = currentVersion;
    try {
      const data = state.existingStore ? await state.api('/customer/orders?limit=30') : await state.api('/orders');
      if (currentVersion !== version || owner !== state.user?.id) return;
      announce(tracker.observe(Array.isArray(data) ? data : data.orders || []), currentVersion);
    } catch { /* Retry without resetting the baseline or replaying old statuses. */ }
    finally { if (currentVersion === version) { loadingVersion = undefined; if (!streamConnected) schedule(); } }
  }
  function start() {
    if (!owner || !notificationSupport() || window.Notification.permission !== 'granted') return;
    if (!state.existingStore || !window.ConfloraSession?.openEventStream) return poll();
    if (stream) return;
    const currentVersion = version;
    stream = window.ConfloraSession.openEventStream('/api/customer/orders/stream');
    stream.addEventListener('order-status', event => {
      if (currentVersion !== version || owner !== state.user?.id) return;
      try {
        const { orders } = JSON.parse(event.data);
        streamConnected = true; window.clearTimeout(timer);
        announce(tracker.observe(orders || []), currentVersion);
      } catch { poll(); }
    });
    const fallback = () => { if (currentVersion === version) { streamConnected = false; poll(); } };
    stream.addEventListener('error', fallback);
    stream.addEventListener('stream-fallback', fallback);
  }
  function setUser(user) {
    const nextOwner = user && !['ADMIN', 'CAIXA', 'VENDEDOR'].includes(user.role) ? user.id : null;
    if (owner === nextOwner) return;
    version++; owner = nextOwner; window.clearTimeout(timer); stream?.close(); stream = undefined; streamConnected = false; tracker = createOrderTracker();
    start();
  }
  function received(order) {
    if (!order?.id || !owner || owner !== state.user?.id) return;
    tracker.remember(order);
    announce([{ order, status: customerOrderStatus(order) }], version);
  }
  const visible = () => { if (document.visibilityState === 'visible') { start(); if (!streamConnected) poll(); } };
  document.addEventListener('visibilitychange', visible);
  return { setUser, received, button: () => permissionButton('Ativar notificações de pedidos', start), dispose: () => { version++; owner = null; stream?.close(); window.clearTimeout(timer); document.removeEventListener('visibilitychange', visible); } };
}
