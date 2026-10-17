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

test('driver accepts a released order, sees route and records payment and delivery on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mockMaps(page);
  expect((await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-caixa1', pin: '0000' } })).ok()).toBe(true);
  const sale = await page.request.post('/api/caixa/orders', { data: { requestId: randomUUID(), items: [{ productId: 'test-plant', quantity: 1 }], paymentMethod: 'DINHEIRO', deferToCashier: true, orderType: 'DELIVERY', customerName: 'Cliente Rota E2E', customerPhone: '64999991234', deliveryAddress: 'Rua das Flores, 20, Centro, Mineiros GO', deliveryLocation: { lat: -17.56, lng: -52.54, reference: 'Portão azul' } } });
  expect(sale.ok()).toBe(true); const { order } = await sale.json();
  expect((await page.request.post(`/api/caixa/deliveries/${order.id}/dispatch`, { data: {} })).ok()).toBe(true);
  await page.request.post('/api/auth/logout');
  await page.goto('/caixa'); await page.getByLabel('Usuário').selectOption('usr-entregador1'); await page.getByLabel('PIN', { exact: true }).fill('2222'); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: '🛵 Entregas', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /PAGAR - F1/ })).toHaveCount(0);
  await page.getByRole('button').filter({ hasText: 'Cliente Rota E2E' }).click();
  const dialog = page.getByRole('dialog', { name: `Comanda #${order.ticketNumber}` });
  await expect(dialog.getByRole('link', { name: 'Abrir no Waze', exact: true })).toHaveAttribute('href', /ll=-17.56%2C-52.54/);
  await expect(dialog).toContainText('2.1 km');
  await dialog.getByRole('button', { name: 'Aceitar e sair para entrega', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Receber na entrega', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '💵 Dinheiro', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirmar pagamento e finalizar', exact: true }).click();
  await expect(dialog).toContainText('Pago / finalizado');
  await expect(page.getByRole('button', { name: 'Concluídas (1)', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/delivery-mobile-finished.png' });
  expect(await page.locator('html').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
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
