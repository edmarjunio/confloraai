const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');

async function mockMaps(page) {
  await page.route('**/api/maps-config', route => route.fulfill({ json: { apiKey: 'test-key', originConfigured: true, storeLocation: { lat: -17.57, lng: -52.55 } } }));
  await page.addInitScript(() => {
    class Map { constructor(node) { node.textContent = 'Mapa de teste'; } addListener() {} panTo() {} fitBounds() {} }
    class AdvancedMarkerElement { constructor(options) { Object.assign(this, options); } addListener() {} }
    class Geocoder { async geocode() { return { results: [{ formatted_address: 'Rua das Flores, 20, Centro, Mineiros GO', geometry: { location: { toJSON: () => ({ lat: -17.56, lng: -52.54 }) } } }] }; } }
    class LatLngBounds { extend() {} }
    const Route = { computeRoutes: async () => ({ routes: [{ path: [{ lat: -17.57, lng: -52.55 }, { lat: -17.56, lng: -52.54 }], distanceMeters: 2100, durationMillis: 300000, createPolylines: () => [], createWaypointAdvancedMarkers: async () => [] }] }) };
    window.google = { maps: { LatLngBounds, importLibrary: async () => ({ Map, AdvancedMarkerElement, Geocoder, Route }) } };
  });
}

test('driver receives new orders live without dispatch, accepts an order, sees route and records payment and delivery on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mockMaps(page);
  await page.goto('/caixa'); await page.getByLabel('Usuário').selectOption('usr-entregador1'); await page.getByLabel('PIN', { exact: true }).fill('2222'); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText('● Atualização automática', { exact: true })).toBeVisible();
  const cashier = await page.context().browser().newContext({ baseURL: 'http://127.0.0.1:8099' });
  let order;
  try {
    expect((await cashier.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } })).ok()).toBe(true);
    const sale = await cashier.request.post('/api/caixa/orders', { data: { requestId: randomUUID(), items: [{ productId: 'test-plant', quantity: 1 }], paymentMethod: 'DINHEIRO', deferToCashier: true, orderType: 'DELIVERY', customerName: 'Cliente Rota E2E', customerPhone: '64999991234', deliveryAddress: 'Rua das Flores, 20, Centro, Mineiros GO', deliveryLocation: { lat: -17.56, lng: -52.54, reference: 'Portão azul' } } });
    expect(sale.ok()).toBe(true); ({ order } = await sale.json());
  } finally { await cashier.close(); }
  await expect(page.getByRole('heading', { name: '🛵 Entregas', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /PAGAR - F1/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir recibo e detalhes da comanda ' + order.ticketNumber }).click();
  const dialog = page.getByRole('dialog', { name: `Comanda #${order.ticketNumber}` });
  await expect(dialog.getByRole('link', { name: 'Abrir no Waze', exact: true })).toHaveAttribute('href', /ll=-17.56%2C-52.54/);
  await dialog.getByRole('button', { name: 'Ver mapa da rota', exact: true }).click();
  await expect(dialog).toContainText('2.1 km');
  await dialog.getByRole('button', { name: 'Ocultar mapa da rota', exact: true }).click();
  await expect(dialog.locator('.cf-receipt')).toContainText('Planta Teste');
  await expect(dialog.locator('.cf-receipt')).not.toContainText('*');
  await dialog.getByRole('button', { name: 'Assumir e separar pedido', exact: true }).click();
  await expect(page.getByRole('region', { name: 'PEDIDOS EM SEPARAÇÃO', exact: true })).toContainText('Cliente Rota E2E');
  await expect(dialog.getByRole('heading', { name: 'Receber na entrega', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Saí da horta · iniciar entrega', exact: true }).click();
  await expect(page.getByRole('region', { name: 'EM ROTA', exact: true })).toContainText('Saiu da horta há');
  await expect(dialog.getByRole('heading', { name: 'Receber na entrega', exact: true })).toBeVisible();
  await dialog.getByLabel('Quilômetros percorridos (opcional)').fill('2.5');
  await dialog.getByRole('button', { name: '💵 Dinheiro', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirmar pagamento e finalizar', exact: true }).click();
  await expect(dialog).toContainText('Pago / finalizado');
  await expect(page.getByRole('region', { name: 'PEDIDOS FINALIZADOS/ENTREGUE', exact: true })).toContainText('Cliente Rota E2E');
  await expect(page.getByRole('region', { name: 'PEDIDOS FINALIZADOS/ENTREGUE', exact: true })).toContainText('Km percorridos informados: 2,5 km');
  await page.screenshot({ path: 'test-results/delivery-mobile-finished.png' });
  expect(await page.locator('html').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.getByText('Desempenho dos entregadores', { exact: true }).click();
  await expect(page.locator('main')).toContainText('Km informados: 2,5 km');
  const action = page.getByRole('button', { name: 'Abrir recibo e detalhes da comanda ' + order.ticketNumber });
  await action.hover();
  await expect(action).toHaveCSS('box-shadow', 'none');
  await expect(action).toHaveCSS('transform', 'none');
  await expect(action.locator('..')).not.toHaveCSS('box-shadow', 'none');
  await page.screenshot({ path: 'test-results/delivery-team-board-desktop.png', fullPage: true });
});

test('customer selects delivery pin using address search and GPS without requiring email', async ({ page, context }) => {
  await mockMaps(page); await context.grantPermissions(['geolocation']); await context.setGeolocation({ latitude: -17.56, longitude: -52.54 });
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.locator('#products .product-card').first()).toBeVisible();
  if (await page.locator('#coachSkip').isVisible()) await page.locator('#coachSkip').click();
  await page.locator('#cartButton').click(); await page.locator('input[name=fulfillment][value=delivery]').check();
  const picker = page.locator('#deliveryLocationPicker'); await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: 'Selecionar no mapa', exact: true }).click();
  await picker.getByRole('searchbox').fill('Rua das Flores, 20, Mineiros'); await picker.getByRole('button', { name: 'Buscar endereço', exact: true }).click();
  await expect(page.locator('[name=address]')).toHaveValue('Rua das Flores, 20, Centro, Mineiros GO');
  await picker.getByRole('button', { name: 'Usar minha localização', exact: true }).click();
  await expect(picker.locator('[data-status]')).toContainText(/selecionada|Toque no mapa/);
  await page.screenshot({ path: 'test-results/delivery-location-mobile.png' });
});

test('delivery map controls stay visible without a configured key and disappear for pickup', async ({ page }) => {
  await page.route('**/api/maps-config', route => route.fulfill({ json: { apiKey: '', storeLocation: null } }));
  await page.goto('/');
  await expect(page.locator('#products .product-card').first()).toBeVisible();
  if (await page.locator('#coachSkip').isVisible()) await page.locator('#coachSkip').click();
  await page.locator('#cartButton').click();
  await page.locator('input[name=fulfillment][value=delivery]').check();
  const picker = page.locator('#deliveryLocationPicker');
  await expect(picker.getByRole('button', { name: 'Selecionar no mapa', exact: true })).toBeVisible();
  await picker.getByRole('button', { name: 'Selecionar no mapa', exact: true }).click();
  await expect(picker.locator('[data-status]')).toContainText('O mapa ainda não está configurado');
  await page.locator('[name=address]').fill('Rua das Flores, 20, Centro');
  await page.locator('input[name=fulfillment][value=pickup]').check();
  await expect(picker).toBeHidden();
});


test('all drivers follow separation and routes live, while only the assigned driver can act', async ({ page, browser }) => {
  const operator = await browser.newContext({ baseURL: 'http://127.0.0.1:8099' });
  const observerId = 'driver-observer-' + randomUUID().slice(0, 8);
  try {
    expect((await operator.request.post('/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } })).ok()).toBe(true);
    expect((await operator.request.post('/api/admin/users', { data: { id: observerId, name: 'Entregador Observador', role: 'ENTREGADOR', pin: '4545', active: true } })).ok()).toBe(true);
    const sale = await operator.request.post('/api/caixa/orders', { data: { requestId: randomUUID(), items: [{ productId: 'test-plant', quantity: 1 }], paymentMethod: 'DINHEIRO', orderType: 'DELIVERY', customerName: 'Entrega de outro entregador', customerPhone: '64999991234', deliveryAddress: 'Rua das Flores, 20, Centro, Mineiros GO' } });
    expect(sale.ok()).toBe(true); const { order } = await sale.json();
    await page.goto('/caixa'); await page.getByLabel('Usuário').selectOption(observerId); await page.getByLabel('PIN', { exact: true }).fill('4545'); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    const open = () => page.getByRole('button', { name: 'Abrir recibo e detalhes da comanda ' + order.ticketNumber });
    await expect(open()).toBeVisible();
    expect((await operator.request.post('/api/admin/auth/login', { data: { userId: 'usr-entregador1', pin: '2222' } })).ok()).toBe(true);
    expect((await operator.request.post(`/api/caixa/deliveries/${order.id}/accept`, { data: {} })).ok()).toBe(true);
    await expect(page.getByRole('region', { name: 'PEDIDOS EM SEPARAÇÃO', exact: true })).toContainText('Entrega de outro entregador');
    await open().click(); const dialog = page.getByRole('dialog', { name: `Comanda #${order.ticketNumber}` });
    await expect(dialog).toContainText('Somente o responsável ou Admin pode alterar');
    await expect(dialog.getByRole('button', { name: 'Saí da horta · iniciar entrega', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
    expect((await operator.request.post(`/api/caixa/deliveries/${order.id}/start`, { data: { route: { distanceMeters: 3000, durationSeconds: 600 } } })).ok()).toBe(true);
    await expect(page.getByRole('region', { name: 'EM ROTA', exact: true })).toContainText('Entrega de outro entregador');
    await expect(page.getByRole('region', { name: 'EM ROTA', exact: true })).toContainText('Saiu da horta há');
    expect((await operator.request.post(`/api/caixa/deliveries/${order.id}/receive`, { data: { paymentMethod: 'DINHEIRO', receivedAmount: 25 } })).ok()).toBe(true);
    await expect(page.getByRole('region', { name: 'PEDIDOS FINALIZADOS/ENTREGUE', exact: true })).toContainText('Entrega de outro entregador');
  } finally { await operator.close(); }
});
