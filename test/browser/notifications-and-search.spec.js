const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

// Isolated browser harness: all scripts are local and no external services are contacted.
test.beforeEach(async ({ page }) => {
  await page.route('http://conflora.test/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<html><head></head><body><form><input id="search"><button>Buscar</button></form><div id="details"></div></body></html>' });
    const file = path.resolve('public/storefront', pathname.slice(1));
    if (!file.startsWith(path.resolve('public/storefront') + path.sep) || !fs.existsSync(file)) return route.abort();
    return route.fulfill({ contentType: file.endsWith('.css') ? 'text/css' : 'application/javascript', body: fs.readFileSync(file) });
  });
  await page.goto('http://conflora.test/');
  await page.addScriptTag({ content: require('../helpers/browser-i18n').script });
  await page.evaluate(() => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(window.navigator, 'serviceWorker', { configurable: true, value: undefined });
    window.notificationCalls = [];
    window.Notification = class {
      static permission = 'default';
      static async requestPermission() { window.notificationCalls.push('permission'); this.permission = 'granted'; return 'granted'; }
      constructor(title) { window.notificationCalls.push(title); }
    };
  });
});

test('autocomplete supports accent-free search, keyboard selection, Escape and pointer selection', async ({ page }) => {
  await page.evaluate(async () => {
    const { createSearchAutocomplete } = await import('/search-autocomplete.js');
    createSearchAutocomplete({ products: [{ name: 'Begônia rosa', isAvailable: true }, { name: 'Begônia branca', status: 'INATIVO' }], config: {} });
  });
  const search = page.locator('#search');
  await search.fill('begon');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(search).toHaveAttribute('aria-expanded', 'true');
  await search.press('ArrowDown');
  await expect(search).toHaveAttribute('aria-activedescendant', 'searchSuggestion0');
  await search.press('Enter');
  await expect(search).toHaveValue('Begônia rosa');
  await expect(page.locator('#searchSuggestions')).toBeHidden();
  await search.fill('beg');
  await expect(page.getByRole('option')).toBeVisible();
  await search.press('Escape');
  await expect(page.locator('#searchSuggestions')).toBeHidden();
  await search.fill('begon');
  await page.getByRole('option').click();
  await expect(search).toHaveValue('Begônia rosa');
  await expect(search).toBeFocused();
});

test('cashier shows one arrival notice with a working details button and no automatic permission request', async ({ page }) => {
  await page.evaluate(async () => {
    window.orderStream = new window.EventTarget();
    window.orderStream.close = () => {};
    window.ConfloraSession = { openEventStream: () => window.orderStream };
    const { createCashierNotifications } = await import('/browser-notifications.js');
    window.stopNotices = createCashierNotifications({ id: 'cashier', role: 'CAIXA' }, id => { document.querySelector('#details').textContent = id; });
    window.orderStream.dispatchEvent(new window.MessageEvent('orders-changed', { data: JSON.stringify({ orderIds: ['old'] }) }));
    window.orderStream.dispatchEvent(new window.MessageEvent('orders-changed', { data: JSON.stringify({ orderIds: ['old', 'new-order'] }) }));
    window.orderStream.dispatchEvent(new window.MessageEvent('orders-changed', { data: JSON.stringify({ orderIds: ['old', 'new-order'] }) }));
  });
  await expect(page.locator('.order-notification-card')).toHaveCount(1);
  await expect(page.locator('.order-notification-card')).toContainText('Acabou de chegar');
  expect(await page.evaluate(() => window.notificationCalls)).toEqual([]);
  await page.getByRole('button', { name: 'VER DETALHES DO PEDIDO' }).click();
  await expect(page.locator('#details')).toHaveText('new-order');
  await page.getByRole('button', { name: 'Ativar notificações do caixa' }).click();
  expect(await page.evaluate(() => window.notificationCalls)).toEqual(['permission']);
  await page.evaluate(() => window.stopNotices());
});

test('customer permission is explicit and only new status changes generate browser notifications', async ({ page }) => {
  await page.evaluate(async () => {
    window.customerStream = new window.EventTarget(); window.customerStream.close = () => {};
    window.ConfloraSession = { openEventStream: () => window.customerStream };
    const { createCustomerOrderNotifications } = await import('/customer-order-notifications.js');
    const state = { existingStore: true, user: { id: 'customer', role: 'CLIENTE' } };
    const monitor = createCustomerOrderNotifications(state, () => {});
    monitor.setUser(state.user);
    document.body.append(monitor.button());
  });
  expect(await page.evaluate(() => window.notificationCalls)).toEqual([]);
  await page.getByRole('button', { name: 'Ativar notificações de pedidos' }).click();
  await page.evaluate(() => {
    const emit = order => window.customerStream.dispatchEvent(new window.MessageEvent('order-status', { data: JSON.stringify({ orders: [order] }) }));
    emit({ id: 'customer-order', status: 'CONFIRMED' });
    emit({ id: 'customer-order', status: 'CONFIRMED', deliveryStatus: 'OUT_FOR_DELIVERY' });
    emit({ id: 'customer-order', status: 'CONFIRMED', deliveryStatus: 'OUT_FOR_DELIVERY' });
  });
  await expect.poll(() => page.evaluate(() => window.notificationCalls)).toEqual(['permission', 'Em rota de entrega']);
});
