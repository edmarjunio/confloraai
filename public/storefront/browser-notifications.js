import { createOrderTracker } from './order-notification-state.mjs';

export function notificationSupport() {
  return window.isSecureContext && 'Notification' in window;
}

export function cashierAlertsEnabled(user) {
  try { return localStorage.getItem(`conflora:cashier-alerts:${user.id}:${user.role}`) !== 'off'; }
  catch { return true; }
}

export function permissionButton(label = 'enable_order_notifications'.tr, onGranted = () => {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'quiet order-notification-permission';
  const paint = () => {
    button.hidden = !notificationSupport() || window.Notification.permission === 'granted';
    button.disabled = notificationSupport() && window.Notification.permission === 'denied';
    button.textContent = button.disabled ? 'notifications_blocked_in_browser_settings'.tr : label;
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
    host.setAttribute('aria-label', 'order_updates'.tr);
    document.body.append(host);
  }
  const card = document.createElement('section');
  card.className = 'order-notification-card';
  card.setAttribute('role', 'status');
  const heading = document.createElement('strong'); heading.textContent = title;
  const description = document.createElement('p'); description.textContent = body;
  const details = document.createElement('button'); details.type = 'button'; details.textContent = 'view_order_details'.tr;
  details.addEventListener('click', () => { card.remove(); onDetails(); });
  const close = document.createElement('button'); close.type = 'button'; close.className = 'order-notification-close'; close.textContent = '×'; close.setAttribute('aria-label', 'dismiss_notification'.tr);
  close.addEventListener('click', () => card.remove());
  card.append(heading, description, details, close);
  host.prepend(card);
  while (host.children.length > 5) host.lastElementChild.remove();
  return () => card.remove();
}

export function createCashierNotifications(user, onDetails, { onArrival = () => {} } = {}) {
  if (!['ADMIN', "CAIXA"].includes(user?.role)) return () => {};
  if (navigator.serviceWorker?.register && window.isSecureContext) navigator.serviceWorker.register('/storefront/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
  let closed = false;
  let fallbackTimer;
  let loading = false;
  const tracker = createOrderTracker('cashier');
  const dismissals = [];
  const preferenceKey = `conflora:cashier-alerts:${user.id}:${user.role}`;
  let enabled = cashierAlertsEnabled(user);
  const control = document.createElement('aside');
  control.className = 'cashier-notification-controls';
  control.setAttribute('aria-label', 'Notificações do caixa');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  const permission = permissionButton('Permitir no navegador');
  const paint = () => {
    toggle.textContent = enabled ? '🔔 Alertas ativos' : 'Alertas desativados';
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('aria-label', enabled ? 'Desativar alertas do caixa' : 'Ativar alertas do caixa');
    permission.hidden = !enabled || !notificationSupport() || window.Notification.permission === 'granted';
  };
  toggle.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(preferenceKey, enabled ? 'on' : 'off'); } catch { /* In-memory preference still applies. */ }
    if (!enabled) dismissals.splice(0).forEach(dismiss => dismiss());
    paint();
  });
  permission.addEventListener('click', () => { window.setTimeout(paint, 0); });
  control.append(toggle, permission);
  paint();
  document.body.append(control);
  const observe = orders => {
    if (closed) return;
    for (const { order } of tracker.observe(orders)) {
      if (!enabled) continue;
      const body = `${'order_just_arrived'.tr}${order.ticketNumber || String(order.id).slice(-8).toUpperCase()}.`;
      const open = () => { if (!closed) onDetails(order.id); };
      dismissals.push(orderNotice({ title: 'new_order_received'.tr, body, onDetails: open }));
      if (dismissals.length > 5) dismissals.shift()();
      onArrival(order);
      showBrowserNotification({ title: 'new_order_received'.tr, body, tag: `cashier:${user.id}:${order.id}`, url: `/caixa?view=commands&order=${encodeURIComponent(order.id)}`, onClick: open, allowed: () => !closed && enabled });
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
