import { createOrderTracker } from './order-notification-state.mjs';

export function notificationSupport() {
  return window.isSecureContext && 'Notification' in window;
}

export function permissionButton(label = 'Ativar notificações de pedidos', onGranted = () => {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'quiet order-notification-permission';
  const paint = () => {
    button.hidden = !notificationSupport() || window.Notification.permission === 'granted';
    button.disabled = notificationSupport() && window.Notification.permission === 'denied';
    button.textContent = button.disabled ? 'Notificações bloqueadas nas configurações do navegador' : label;
  };
  button.addEventListener('click', async () => {
    if (!notificationSupport()) return;
    try { if (await window.Notification.requestPermission() === 'granted') onGranted(); }
    catch { /* Unsupported browser policies keep the button available for later. */ }
    finally { paint(); }
  });
  paint();
  return button;
}

export async function showBrowserNotification({ title, body, tag, url, onClick, allowed = () => true }) {
  if (!notificationSupport() || window.Notification.permission !== 'granted' || !allowed()) return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration('/');
    if (!allowed()) return;
    if (registration?.active) {
      await registration.showNotification(title, { body, tag, icon: '/store-assets/brands/conflora-logo.png', data: { url, clientUrl: window.location.href } });
    } else {
      const notification = new window.Notification(title, { body, tag });
      notification.onclick = () => { notification.close(); window.focus(); if (allowed()) onClick?.(); };
    }
  } catch { /* In-page order details remain available when browser notifications fail. */ }
}

export function orderNotice({ title, body, onDetails }) {
  let host = document.querySelector('#orderNotificationStack');
  if (!host) {
    host = document.createElement('aside');
    host.id = 'orderNotificationStack';
    host.className = 'order-notification-stack';
    host.setAttribute('aria-label', 'Atualizações de pedidos');
    document.body.append(host);
  }
  const card = document.createElement('section');
  card.className = 'order-notification-card';
  card.setAttribute('role', 'status');
  const heading = document.createElement('strong'); heading.textContent = title;
  const description = document.createElement('p'); description.textContent = body;
  const details = document.createElement('button'); details.type = 'button'; details.textContent = 'VER DETALHES DO PEDIDO';
  details.addEventListener('click', () => { card.remove(); onDetails(); });
  const close = document.createElement('button'); close.type = 'button'; close.className = 'order-notification-close'; close.textContent = '×'; close.setAttribute('aria-label', 'Dispensar notificação');
  close.addEventListener('click', () => card.remove());
  card.append(heading, description, details, close);
  host.prepend(card);
  while (host.children.length > 5) host.lastElementChild.remove();
  return () => card.remove();
}

export function createCashierNotifications(user, onDetails) {
  if (!['ADMIN', 'CAIXA'].includes(user?.role)) return () => {};
  if (navigator.serviceWorker?.register && window.isSecureContext) navigator.serviceWorker.register('/storefront/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
  let closed = false;
  let fallbackTimer;
  let loading = false;
  const tracker = createOrderTracker('cashier');
  const dismissals = [];
  const control = permissionButton('Ativar notificações do caixa');
  control.classList.add('cashier-notification-permission');
  document.body.append(control);
  const observe = orders => {
    if (closed) return;
    for (const { order } of tracker.observe(orders)) {
      const body = `Acabou de chegar o pedido #${order.ticketNumber || String(order.id).slice(-8).toUpperCase()}.`;
      const open = () => { if (!closed) onDetails(order.id); };
      dismissals.push(orderNotice({ title: 'Novo pedido recebido', body, onDetails: open }));
      if (dismissals.length > 5) dismissals.shift()();
      showBrowserNotification({ title: 'Novo pedido recebido', body, tag: `cashier:${user.id}:${order.id}`, url: `/caixa?view=commands&order=${encodeURIComponent(order.id)}`, onClick: open, allowed: () => !closed });
    }
  };
  const refresh = async () => {
    if (loading || closed) return;
    loading = true;
    try {
      const response = await window.ConfloraSession.apiFetch('/api/caixa/orders');
      if (!response.ok) return;
      const data = await response.json();
      const unique = new Map(['pendingConfirmation', 'pendingPayment', 'awaitingDriver', 'outForDelivery'].flatMap(key => data[key] || []).map(order => [order.id, order]));
      observe([...unique.values()]);
    } catch { /* SSE reconnects and polling retries transient failures. */ }
    finally { loading = false; }
  };
  const stream = window.ConfloraSession.openEventStream('/api/caixa/orders/stream');
  stream.addEventListener('orders-changed', event => {
    try {
      const data = JSON.parse(event.data);
      observe((data.orderIds || []).map(id => ({ id })));
      window.clearInterval(fallbackTimer); fallbackTimer = undefined;
    } catch { refresh(); }
  });
  const fallback = () => { if (!fallbackTimer) { refresh(); fallbackTimer = window.setInterval(refresh, 30000); } };
  stream.addEventListener('error', fallback);
  stream.addEventListener('stream-fallback', fallback);
  return () => { closed = true; stream.close(); window.clearInterval(fallbackTimer); control.remove(); dismissals.forEach(dismiss => dismiss()); };
}
