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

export function orderNotice({ title, body, onDetails, order }) {
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
  if (order) {
    host.classList.add('cashier-order-notifications');
    const source = [...document.querySelectorAll('[data-order-id]')].find(node => node.dataset.orderId === order.id);
    if (source) {
      const copy = source.cloneNode(true);
      copy.removeAttribute('data-order-id'); copy.removeAttribute('draggable');
      copy.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { card.remove(); onDetails(); }));
      card.replaceChildren(copy, close); card.classList.add('order-notification-card--comanda');
    } else {
      heading.textContent = 'Comanda #' + (order.ticketNumber || order.id.slice(-6));
      description.textContent = [order.customerName || 'Cliente Balcão', (order.items || []).slice(0, 2).map(item => item.quantity + ' × ' + item.name).join(' · '), Number(order.total || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})].join(' — ');
      card.style.background = order.paymentStatus === 'APPROVED' ? '#d1fae5' : '#bfdbfe';
    }
    // The board and the notification stream can finish their requests in either order.
    setTimeout(() => {
      if (!card.isConnected || card.classList.contains('order-notification-card--comanda')) return;
      const source = [...document.querySelectorAll('[data-order-id]')].find(node => node.dataset.orderId === order.id);
      if (!source) return;
      const copy = source.cloneNode(true); copy.removeAttribute('data-order-id'); copy.removeAttribute('draggable');
      copy.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { card.remove(); onDetails(); }));
      card.replaceChildren(copy, close); card.classList.add('order-notification-card--comanda');
    }, 500);
    const timer = setTimeout(() => {
      if (!card.isConnected) return;
      const target = [...document.querySelectorAll('[data-order-id]')].find(node => node.dataset.orderId === order.id);
      if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { card.remove(); return; }
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      const from = card.getBoundingClientRect(), to = target.getBoundingClientRect();
      const animation = card.animate([{transform:'translate(0,0)', opacity:1}, {transform: 'translate(' + (to.left-from.left) + 'px,' + (to.top-from.top) + 'px) scale(' + (to.width/from.width) + ')', opacity:0}], {duration:650, easing:'cubic-bezier(.4,0,.2,1)', fill:'forwards'});
      animation.onfinish = () => card.remove();
    }, 6500);
    close.addEventListener('click', () => clearTimeout(timer));
  }
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
      dismissals.push(orderNotice({ title: 'Novo pedido recebido', body, onDetails: open, order }));
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
      const unique = new Map(['pendingConfirmation', 'pendingPayment', 'awaitingDriver', 'outForDelivery', 'paid'].flatMap(key => data[key] || []).map(order => [order.id, order]));
      observe([...unique.values()]);
    } catch { /* SSE reconnects and polling retries transient failures. */ }
    finally { loading = false; }
  };
  const stream = window.ConfloraSession.openEventStream('/api/caixa/orders/stream');
  stream.addEventListener('orders-changed', event => {
    try {
      JSON.parse(event.data);
      refresh();
      window.clearInterval(fallbackTimer); fallbackTimer = undefined;
    } catch { refresh(); }
  });
  const fallback = () => { if (!fallbackTimer) { refresh(); fallbackTimer = window.setInterval(refresh, 30000); } };
  stream.addEventListener('error', fallback);
  stream.addEventListener('stream-fallback', fallback);
  return () => { closed = true; stream.close(); window.clearInterval(fallbackTimer); control.remove(); dismissals.forEach(dismiss => dismiss()); };
}
