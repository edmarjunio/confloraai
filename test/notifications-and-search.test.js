const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const path = require('node:path');
const esbuild = require('esbuild');

test('customer order transitions report delivery progress once and ignore the initial history', async () => {
  const { createOrderTracker } = await import('../public/storefront/order-notification-state.mjs');
  const tracker = createOrderTracker();
  const order = { id: 'one', status: 'AWAITING_PAYMENT' };
  assert.deepEqual(tracker.observe([order]), []);
  const route = { ...order, status: 'CONFIRMED', paidAt: '2026-10-21', deliveryStatus: 'OUT_FOR_DELIVERY' };
  assert.equal(tracker.observe([route])[0].status, 'Em rota de entrega');
  assert.deepEqual(tracker.observe([route]), []);
  assert.equal(tracker.observe([{ ...route, deliveryStatus: 'DELIVERED' }])[0].status, 'Pedido entregue');
  assert.equal(tracker.observe([{ ...order, id: 'two' }])[0].status, 'Pedido recebido');
});

test('cashier arrivals do not repeat after stage moves, disappearance or reconnect', async () => {
  const { createOrderTracker } = await import('../public/storefront/order-notification-state.mjs');
  const tracker = createOrderTracker('cashier');
  assert.deepEqual(tracker.observe([{ id: 'old' }]), []);
  assert.deepEqual(tracker.observe([{ id: 'old' }, { id: 'new' }]).map(change => change.order.id), ['new']);
  tracker.observe([]);
  assert.deepEqual(tracker.observe([{ id: 'new', deliveryStatus: 'OUT_FOR_DELIVERY' }]), []);
});

test('suggestions handle accents, aliases and categories while excluding inactive products', async () => {
  const { buildSearchSuggestions } = await import('../public/storefront/search-suggestions.mjs');
  const products = [
    { id: 'a', name: 'Begônia rosa', categoryName: 'Flores', isAvailable: true },
    { id: 'b', name: 'Begônia branca', status: 'INATIVO' },
    { id: 'c', name: 'Begônia amarela', isAvailable: false },
    { id: 'd', name: 'Mandioca', searchAliases: ['aipim'], categoryName: 'Hortifrutti' },
  ];
  assert.deepEqual(buildSearchSuggestions(products, 'begon').map(item => item.label), ['Begônia rosa']);
  assert.deepEqual(buildSearchSuggestions(products, 'aipim').map(item => item.label), ['Mandioca']);
  assert.equal(buildSearchSuggestions(products, 'flor')[0].kind, 'Categoria');
  assert.equal(buildSearchSuggestions(products, 'a').length, 0);
  assert.equal(buildSearchSuggestions(products, 'cliente@email').length, 0);
});

function loadCustomerMonitor() {
  const shown = [];
  const streams = [];
  const module = { exports: {} };
  class Notification {
    static permission = 'granted';
    constructor(title, options) { shown.push({ title, ...options }); }
  }
  const window = {
    Notification, isSecureContext: true, location: { href: 'https://conflora.test/' },
    clearTimeout() {}, setTimeout() {},
    ConfloraSession: { openEventStream() {
      const handlers = {};
      const stream = { handlers, addEventListener(name, callback) { handlers[name] = callback; }, close() { this.closed = true; } };
      streams.push(stream); return stream;
    } },
  };
  const code = esbuild.buildSync({ entryPoints: [path.resolve('public/storefront/customer-order-notifications.js')], bundle: true, platform: 'browser', format: 'cjs', write: false }).outputFiles[0].text;
  vm.runInNewContext(require('./helpers/browser-i18n').script + code, { window, navigator: {}, document: { addEventListener() {}, removeEventListener() {} }, module, exports: module.exports });
  return { api: module.exports, shown, streams, window };
}

test('customer streams close on account changes and discard late events from the previous account', async () => {
  const { api, shown, streams } = loadCustomerMonitor();
  const state = { existingStore: true, user: { id: 'a', role: 'CLIENTE' } };
  const monitor = api.createCustomerOrderNotifications(state, () => {});
  monitor.setUser(state.user);
  const emit = (stream, orders) => stream.handlers['order-status']({ data: JSON.stringify({ orders }) });
  emit(streams[0], [{ id: 'order-a', status: 'AWAITING_PAYMENT' }]);
  state.user = { id: 'b', role: 'CLIENTE' };
  monitor.setUser(state.user);
  assert.equal(streams[0].closed, true);
  emit(streams[0], [{ id: 'order-a', deliveryStatus: 'OUT_FOR_DELIVERY' }]);
  emit(streams[1], [{ id: 'order-b', status: 'AWAITING_PAYMENT' }]);
  emit(streams[1], [{ id: 'order-b', deliveryStatus: 'OUT_FOR_DELIVERY' }]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, 'Em rota de entrega');
  monitor.dispose();
});

test('denied notification permission never opens a stream or prompts automatically', () => {
  const { api, shown, streams, window } = loadCustomerMonitor();
  window.Notification.permission = 'denied';
  const state = { existingStore: true, user: { id: 'a', role: 'CLIENTE' } };
  const monitor = api.createCustomerOrderNotifications(state, () => {});
  monitor.setUser(state.user);
  assert.equal(streams.length, 0);
  assert.equal(shown.length, 0);
  monitor.dispose();
});
