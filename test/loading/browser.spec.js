const { test: base, expect } = require('@playwright/test');
const fs = require('node:fs');
require('../../scripts/test-env');
const { dispatch } = require('../helpers/in-process-http');
const { createApp } = require('../../src/http/app');
const { FirestoreRepository } = require('../helpers/repository-fixture');
const { StoreRepository } = require('../../src/storefront/repository');
const { seedStores } = require('../storefront-fixture');

const test = base.extend({
  fixture: async ({ context }, use) => {
    const repo = new FirestoreRepository({ isInMemory: true, productImageStorage: require('../helpers/actual-photo-fixture').isolatedPhotoStorage() });
    for (let index = 0; index < 80; index++) await repo.saveProduct({
      id: 'product-' + index, name: 'Produto ' + String(index).padStart(3, '0'),
      category: 'Horta', price: 10 + index, stockQuantity: 100, status: 'ATIVO',
    });
    const tenants = new StoreRepository(); await seedStores(tenants);
    const app = createApp({ storeRepository: tenants, messageService: { firestoreRepo: repo, catalogRepo: { items: [], refreshCatalog: async () => {} } } });
    const requests = [];
    const errors = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    await context.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.hostname !== 'conflora.test') return route.abort();
      requests.push(url.pathname);
      if (url.pathname.endsWith('/stream')) return route.fulfill({ contentType: 'text/event-stream', body: '' });
      const response = await dispatch(app, url, { method: request.method(), headers: request.headers(), body: request.postDataBuffer() });
      const body = Buffer.from(await response.arrayBuffer());
      const headers = Object.fromEntries(response.headers.entries());
      delete headers['content-length']; delete headers['transfer-encoding'];
      return route.fulfill({ status: response.status, headers, body });
    });
    await use({ repo, app, requests, errors });
    expect(errors).toEqual([]);
  },
});
const cards = page => page.locator('#products render-product-card');
const ready = async page => { await page.goto('/'); await expect(cards(page).first()).toBeVisible(); };
const agePublicCache = page => page.evaluate(() => new Promise((resolve, reject) => {
  const request = window.indexedDB.open('cf-public-20261023-real-products1', 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result; const tx = db.transaction('catalog', 'readwrite'); const store = tx.objectStore('catalog');
    const read = store.get('main:conflora');
    read.onsuccess = () => store.put({ ...read.result, savedAt: Date.now() - 61000 }, 'main:conflora');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  };
}));
const login = (page, userId = 'usr-edmar', pin = '1234') => page.evaluate(async ({ userId, pin }) => {
  const response = await window.ConfloraSession.apiFetch('/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, pin }) });
  if (!response.ok) throw new Error('login rejected');
}, { userId, pin });

test('fresh second visit reuses the public snapshot and defers secondary modules', async ({ page, fixture }) => {
  await ready(page);
  const manifest = JSON.parse(fs.readFileSync('public/storefront/dist/manifest.json'));
  const secondary = Object.entries(manifest.outputs).filter(([, value]) => /(?:admin|product-entry|product-info-content)\.js$/.test(value.entryPoint || '')).map(([file]) => '/' + file.replace(/^public\//, ''));
  expect(secondary.length).toBeGreaterThan(0);
  expect(fixture.requests.filter(file => secondary.includes(file))).toEqual([]);
  const initialCatalog = fixture.requests.filter(file => file === '/api/storefront/catalog').length;
  await page.reload(); await expect(cards(page).first()).toBeVisible();
  expect(fixture.requests.filter(file => file === '/api/storefront/catalog').length).toBe(initialCatalog);
  await expect(page.locator('#catalogSyncStatus')).toBeHidden();
  expect(await cards(page).first().locator('img').getAttribute('loading')).toBe('eager');
  expect(await cards(page).nth(10).locator('img').getAttribute('loading')).toBe('lazy');
});

test('operational layout fits the viewport, preserves WhatsApp width and keeps metrics compact', async ({ page, fixture: _fixture }) => {
  await ready(page); await login(page); await page.goto('/pdv?view=commands');
  await expect(page.getByLabel('Etapa das comandas')).toHaveValue('pending');
  const compact = page.getByLabel('Resumo de valores das comandas');
  await expect(compact).not.toHaveAttribute('open');
  if (page.viewportSize().width < 768) await page.getByRole('button', { name: /^WhatsApp \(/ }).click();
  const whatsapp = page.locator('.cf-orders-whatsapp');
  await expect(whatsapp).toBeVisible();
  expect((await whatsapp.boundingBox()).width).toBeGreaterThan(220);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `test-results/operations-${page.viewportSize().width}.png`, fullPage: true });
});

test('delivery role has its own orange shortcut and a deterministic way home', async ({ page, fixture: _fixture }) => {
  await ready(page); await login(page, 'usr-entregador1', '2222'); await page.reload();
  await expect(page.locator('#cashierShortcut')).toBeVisible();
  await expect(page.locator('#customerAccountShortcut')).toBeHidden();
  await expect(page.locator('#cashierShortcut')).toContainText(/entregas/i);
  await page.locator('#cashierShortcut').click();
  const home = page.getByRole('link', { name: 'Início', exact: true });
  await expect(home).toBeVisible(); await home.click();
  await expect(cards(page).first()).toBeVisible();
});

test('cashier alerts start active and an explicit opt-out survives reload', async ({ page, fixture: _fixture }) => {
  await ready(page); await login(page); await page.goto('/pdv');
  await page.getByRole('button', { name: 'Desativar alertas do caixa' }).click();
  await expect(page.getByRole('button', { name: 'Ativar alertas do caixa' })).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await page.getByRole('button', { name: 'Ativar alertas do caixa' }).click();
  await expect(page.getByRole('button', { name: 'Desativar alertas do caixa' })).toHaveAttribute('aria-pressed', 'true');
});

test('a confirmed product uses the identical visible image in storefront and cashier', async ({ page, context, fixture }) => {
  const photo = require('../helpers/actual-photo-fixture').actualPhotoFixture('product-0');
  Object.assign(fixture.repo.inMemoryProducts.get('product-0'), photo);
  await context.route('**/v0/b/**', route => route.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync('test/fixtures/images/store-assets/products/rolinha-diamante.jpg') }));
  await ready(page);
  const image = cards(page).first().locator('img');
  await expect(image).toHaveAttribute('src', photo.imageUrl);
  await expect.poll(() => image.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await login(page); await page.goto('/pdv');
  const cashierImage = page.locator('render-product-card').first().locator('img');
  await expect(cashierImage).toHaveAttribute('src', photo.imageUrl);
  await expect.poll(() => cashierImage.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `test-results/cashier-${page.viewportSize().width}.png` });
});

test('mobile cashier buttons stay aligned at narrow store-phone widths', async ({ page, fixture: _fixture }) => {
  test.skip(page.viewportSize().width >= 768, 'Mobile layout only');
  await ready(page); await login(page); await page.goto('/pdv');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const buttons = page.locator('.cf-mobile-sale-heading > button');
    await expect(buttons).toHaveCount(4);
    const rects = await buttons.evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { top: box.top, width: box.width, height: box.height }; }));
    expect(Math.max(...rects.map(rect => rect.top)) - Math.min(...rects.map(rect => rect.top))).toBeLessThan(1);
    expect(rects.every(rect => rect.width >= 44 && rect.height >= 44)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test('product editor uploads a confirmed photo through the official Storage service and refreshes the listing', async ({ page, fixture }) => {
  await ready(page); await login(page); await page.reload();
  await expect(page.locator('#headerAccountRole')).toHaveText('ADMIN');
  await page.evaluate(() => window.state.productEntry.open());
  const dialog = page.locator('#productEntryDialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('[name=name]').fill('Produto com foto real');
  await dialog.locator('[name=price]').fill('12.50');
  await dialog.locator('details').evaluate(node => { node.open = true; });
  await dialog.locator('input[type=file]').setInputFiles('test/fixtures/images/store-assets/products/rolinha-diamante.jpg');
  await dialog.locator('input[type=checkbox]').check();
  await dialog.locator('button[type=submit]').click();
  await expect(dialog).not.toBeVisible();
  const product = [...fixture.repo.inMemoryProducts.values()].find(row => row.name === 'Produto com foto real');
  expect(product.imageProvenance.kind).toBe('CONFLORA_ACTUAL_PRODUCT');
  expect(product.imageUrl).toMatch(/^https:\/\/firebasestorage.googleapis.com\//);
  await expect.poll(() => page.evaluate(id => window.state.products.find(row => row.id === id)?.imageUrl, product.id)).toBe(product.imageUrl);
});

test('revalidation preserves unchanged cards and updates live price and stock in the cart', async ({ page, fixture }) => {
  await ready(page);
  await page.evaluate(() => { window.unchangedCard = document.querySelectorAll('#products render-product-card')[1]; });
  await cards(page).first().locator('[data-action=add]').last().click();
  await expect(page.locator('#cartCount')).toHaveText('1');
  const changed = fixture.repo.inMemoryProducts.get('product-0');
  changed.price = 27; changed.stockQuantity = 2;
  fixture.app.locals.publicCatalogCache.invalidate();
  await page.evaluate(() => window.state.reloadProducts());
  expect(await page.evaluate(() => window.unchangedCard === document.querySelectorAll('#products render-product-card')[1])).toBe(true);
  await expect(cards(page).first()).toContainText('27,00');
  await expect(page.locator('#cartCount')).toHaveText('1');
  await page.locator('#cartButton').click();
  await expect(page.locator('#cartTotal')).toContainText('27,00');
  expect(await page.evaluate(() => window.state.products[0].stock.quantity)).toBe(2);
});

test('history and progressive rendering preserve the catalogue and cart', async ({ page, fixture }) => {
  await ready(page);
  await cards(page).first().locator('[data-action=add]').last().click();
  await page.evaluate(() => {
    window.scrollTo(0, 400);
    document.querySelector('#products [data-action=open]').click();
  });
  await expect(page.locator('#productView h1')).toHaveText('Produto 000');
  await page.goBack();
  await expect(cards(page).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400);
  await expect(page.locator('#cartCount')).toHaveText('1');
  const count = await cards(page).count();
  await page.locator('#loadMore').scrollIntoViewIfNeeded();
  await expect.poll(() => cards(page).count()).toBeGreaterThan(count);
  expect(fixture.requests.filter(file => file === '/api/storefront/catalog')).toHaveLength(1);
});

test('lazy administration opens, logout and switching users keep private drafts isolated', async ({ page, context, fixture }) => {
  await ready(page); await login(page); await page.reload();
  await expect(page.locator('#headerAccountRole')).toHaveText('ADMIN');
  await cards(page).first().locator('[data-action=add]').last().click();
  await page.evaluate(() => window.state.productEntry.open());
  await expect(page.locator('#productEntryDialog')).toBeVisible();
  await page.evaluate(() => document.querySelector('#productEntryDialog').close());
  const second = await context.newPage(); await ready(second);
  await login(second, 'usr-caixa1', '0000'); await second.reload();
  await expect(second.locator('#headerAccountRole')).toHaveText('CAIXA');
  await expect(second.locator('#cartCount')).toHaveText('0');
  await second.evaluate(() => window.ConfloraSession.apiFetch('/api/auth/logout', { method: 'POST' }));
  await second.reload(); await expect(second.locator('#accountButton')).toBeVisible();
  await page.reload(); await expect(page.locator('#headerAccountRole')).toHaveText('ADMIN');
  // The current session keeps drafts in memory; reload never restores a private
  // cart from public persistence or from the other tab's user.
  await expect(page.locator('#cartCount')).toHaveText('0');
  const shared = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('conflora:public-catalog:')).map(([, value]) => value).join(''));
  expect(shared).not.toMatch(/usr-edmar|usr-caixa1|Bearer|conflora_tab_token/);
  expect(fixture.errors).toEqual([]);
});

test('stale public data remains visible through a failed update and tenant caches stay isolated', async ({ page, fixture }) => {
  await ready(page);
  await agePublicCache(page);
  await page.route('**/api/storefront/catalog', route => route.fulfill({ status: 503, json: { error: 'offline fixture' } }));
  await page.reload(); await expect(cards(page).first()).toBeVisible();
  await expect(page.locator('#storeName')).toHaveText('Conflora Horta e Viveiro');
  await page.goto('/shop/garden'); await expect(page.locator('#storeName')).toHaveText('Jardim Local');
  await page.goto('/shop/pets'); await expect(page.locator('#storeName')).toHaveText('Casa Pet');
  await expect(cards(page)).toHaveCount(2);
  expect(fixture.errors).toEqual([]);
});

test('checkout creates an order from authoritative prices even when the displayed snapshot is old', async ({ page, fixture }) => {
  await ready(page);
  await cards(page).first().locator('[data-action=add]').last().click();
  fixture.repo.inMemoryProducts.get('product-0').price = 19;
  await page.locator('#cartButton').click();
  await page.locator('#checkoutCustomer [name=name]').fill('Cliente de laboratório');
  await page.locator('#checkoutCustomer [name=phone]').fill('64999990000');
  await page.locator('[name=fulfillment][value=pickup]').check();
  await page.locator('[name=payment][value=CASH]').check();
  await page.locator('#checkoutForm [name=cash]').fill('100');
  await page.locator('#submitOrder').click();
  await page.locator('#orderReviewConfirm').click();
  await expect(page.locator('#receipt')).toBeVisible();
  const orders = [...fixture.repo.inMemoryOrders.values()];
  expect(orders).toHaveLength(1);
  expect(orders[0].items[0].price).toBe(19);
  expect(orders[0].total).toBe(19);
  await expect(page.locator('#receipt')).toContainText('19,00');
  await expect(page.locator('#cartCount')).toHaveText('0');
});

test('data saver prevents speculative imports while explicit product information still opens', async ({ page, context, fixture }) => {
  await context.addInitScript(() => Object.defineProperty(window.navigator, 'connection', { configurable: true, value: { saveData: true, effectiveType: '2g' } }));
  await ready(page);
  const manifest = JSON.parse(fs.readFileSync('public/storefront/dist/manifest.json'));
  const info = Object.entries(manifest.outputs).find(([, value]) => /product-info-content\.js$/.test(value.entryPoint || ''));
  const url = '/' + info[0].replace(/^public\//, '');
  await cards(page).first().hover(); await page.waitForTimeout(160);
  expect(fixture.requests).not.toContain(url);
  await cards(page).first().locator('[data-action=info]').click();
  await expect(page.locator('#productInfoDialog')).toBeVisible();
  expect(fixture.requests).toContain(url);
});

test('storefront and cashier load the same structured details on demand without bloating lists', async ({ page, fixture }) => {
  Object.assign(fixture.repo.inMemoryProducts.get('product-0'), { source: 'MANUAL', description: 'Vaso cadastrado pela equipe',
    specifications: { width: { label: 'Largura', value: 20, unit: 'cm' } } });
  await ready(page);
  expect(fixture.requests.filter(path => path === '/api/storefront/products/product-0')).toHaveLength(0);
  await cards(page).first().locator('[data-action=info]').click();
  await expect(page.locator('#productInfoDialog')).toContainText('Vaso cadastrado pela equipe');
  await expect(page.locator('#productInfoDialog')).toContainText('20 cm');
  expect(fixture.requests).toContain('/api/storefront/products/product-0');
  await login(page);
  await page.goto('/pdv');
  await page.getByRole('button', { name: 'Informações de Produto 000', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Vaso cadastrado pela equipe');
  await expect(page.getByRole('dialog')).toContainText('20 cm');
  expect(fixture.requests).toContain('/api/caixa/products/product-0');
});

test('idle tabs stop periodic catalogue reads and revalidate when interaction resumes', async ({ page, fixture }) => {
  await page.clock.install();
  await ready(page);
  const count = () => fixture.requests.filter(file => file === '/api/storefront/catalog').length;
  expect(count()).toBe(1);
  await page.clock.fastForward(61000);
  await expect.poll(count).toBe(2);
  await page.clock.fastForward(180000);
  expect(count()).toBe(2);
  await page.locator('#search').press('a');
  await expect.poll(count).toBe(3);
});

test('storage invalidation ignores unrelated apps and refreshes after an explicit shared generation', async ({ page, fixture }) => {
  await ready(page);
  const count = () => fixture.requests.filter(file => file === '/api/storefront/catalog').length;
  const invalidate = key => page.evaluate(key => {
    window.dispatchEvent(new window.StorageEvent('storage', { key, newValue: null }));
  }, key);
  await invalidate('conflora:public-catalog:v1:tenant%3Agarden%3Av4');
  // Flush asynchronous handlers before checking that another shop caused no request.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
  expect(count()).toBe(1);
  await invalidate('cf-public-invalidated');
  await expect.poll(count).toBe(2);
});

test('a slow public refresh leaves the cached catalogue usable until new data arrives', async ({ page, fixture }) => {
  await ready(page);
  await agePublicCache(page);
  fixture.repo.inMemoryProducts.get('product-0').price = 31;
  fixture.app.locals.publicCatalogCache.invalidate();
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  await page.route('**/api/storefront/catalog**', async route => {
    await delayed;
    await route.fallback();
  });
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(cards(page).first()).toBeVisible();
    await expect(cards(page).first()).toContainText('10,00');
    await cards(page).first().locator('[data-action=add]').last().click();
    await expect(page.locator('#cartCount')).toHaveText('1');
  } finally { release(); }
  await expect(cards(page).first()).toContainText('31,00');
  await page.locator('#cartButton').click();
  await expect(page.locator('#cartTotal')).toContainText('31,00');
});

test('administration quotes a procurement comanda, confirms its deposit and arrival, then collects only its balance', async ({ page, fixture }) => {
  const intake = fixture.app.locals.orderIntake;
  const phone = '5564999990001';
  await intake.handle({ phone, message: 'Quero 2 galinhas da angola', messageId: 'browser-offer', customerName: 'Cliente da encomenda' });
  const saved = await intake.handle({ phone, message: 'sim', messageId: 'browser-confirm', customerName: 'Cliente da encomenda' });
  await ready(page); await login(page); await page.reload();
  await expect(page.locator('#headerAccountRole')).toHaveText('ADMIN');
  await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Encomendas', exact: true }).click();
  await expect(page.locator('#adminView')).toContainText('2 galinhas da angola');
  await page.getByLabel('Valor unitário de galinhas da angola (R$)').fill('40');
  const arrivalDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel('Data da chegada do item: galinhas da angola').fill(arrivalDate);
  await page.getByLabel('Valores e datas confirmados com o responsável ou fornecedor').check();
  await page.getByLabel('Comercialização permitida conferida').check();
  await page.getByRole('button', { name: 'Confirmar cotação e consultar cliente' }).click();
  await expect(page.locator('#adminView')).toContainText('Aguardando aceite do cliente');
  await intake.handle({ phone, message: 'sim', messageId: 'browser-accept' });
  await page.getByRole('button', { name: 'Atualizar encomendas' }).click();
  await expect(page.locator('#adminView')).toContainText('Aguardando chegada');
  await page.getByLabel('Conferi o recebimento efetivo do sinal').check();
  await page.getByRole('button', { name: 'Confirmar recebimento do sinal' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar chegada e avisar cliente' })).toBeVisible();
  await page.getByLabel('Produto cadastrado para galinhas da angola').selectOption('product-0');
  await page.getByLabel('Todos os itens chegaram e foram conferidos').check();
  await page.getByRole('button', { name: 'Confirmar chegada e avisar cliente' }).click();
  await expect(page.locator('#adminView')).toContainText('Disponível: aguardando entrega ou retirada');
  expect(fixture.repo.inMemoryProducts.get('product-0').reservedQuantity).toBe(2);
  await intake.handle({ phone, message: 'retirada', messageId: 'browser-pickup' });
  const status = await page.evaluate(async id => {
    const response = await window.ConfloraSession.apiFetch('/api/caixa/orders/' + id + '/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentMethod: 'DINHEIRO', receivedAmount: 40 }) });
    return { status: response.status, data: await response.json() };
  }, saved.requestId);
  expect(status.status).toBe(200); expect(status.data.order.paymentParts[0].amount).toBe(40);
  expect(status.data.order.total).toBe(80); expect(status.data.order.amountDue).toBe(0);
  expect(fixture.repo.inMemoryOrders.size).toBe(1);
  expect(fixture.repo.inMemoryProducts.get('product-0').stockQuantity).toBe(98);
});

test('procurement Pix deposit uploads its private proof and requires bank verification in the staff form', async ({ page, fixture }) => {
  const intake = fixture.app.locals.orderIntake, phone = '5564999990001';
  await intake.handle({ phone, message: 'Quero 2 galinhas', messageId: 'pix-offer' });
  const saved = await intake.handle({ phone, message: 'sim', messageId: 'pix-register' });
  await intake.procurement.quote(saved.requestId, { version: 1, confirmed: true, commercializationAllowed: true,
    items: [{ unitPriceMinor: 4000, arrivalDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) }] }, { id: 'usr-edmar', role: 'ADMIN' });
  await intake.handle({ phone, message: 'sim', messageId: 'pix-accept' });
  await ready(page); await login(page); await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Encomendas', exact: true }).click();
  await page.getByLabel('Forma de pagamento do sinal').selectOption('PIX');
  await page.getByLabel('Comprovante do sinal Pix').setInputFiles({ name: 'pix-sinal.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nproof') });
  await expect(page.locator('body')).toContainText('Comprovante anexado.');
  await page.getByLabel('Observação da conferência do sinal Pix').fill('Crédito conferido no banco');
  await page.getByLabel('Conferi o valor creditado na conta da Conflora').check();
  await page.getByLabel('Conferi o recebimento efetivo do sinal').check();
  await page.getByRole('button', { name: 'Confirmar recebimento do sinal' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar chegada e avisar cliente' })).toBeVisible();
  const order = await intake.store.read('orders', saved.requestId);
  expect(order.procurement.deposit.method).toBe('PIX'); expect(order.procurement.deposit.proof.id).toBeTruthy();
  expect(order.procurement.deposit.amountMinor).toBe(4000); expect(order.completedAt).toBeUndefined();
});

test('procurement cards use shared buttons, preserve draft fields and show the exact 50/50 currency amounts', async ({ page, fixture }, testInfo) => {
  const intake = fixture.app.locals.orderIntake;
  const create = async (phone, name) => {
    await intake.handle({ phone, customerName: name, message: 'Quero 2 galinhas', messageId: phone + '-offer' });
    return intake.handle({ phone, customerName: name, message: 'sim', messageId: phone + '-confirm' });
  };
  const ana = await create('5564999990001', 'Ana'); await create('5564999990002', 'Bruno');
  await ready(page); await login(page); await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Encomendas', exact: true }).click();
  const card = page.locator(`[data-request-id="${ana.requestId}"]`);
  await expect(card).toBeVisible();
  if (await card.getByRole('button', { name: 'Abrir comanda', exact: true }).isVisible()) await card.getByRole('button', { name: 'Abrir comanda', exact: true }).click();
  await card.getByLabel('Valor unitário de galinhas (R$)').fill('40');
  await expect(card.locator('.procurement-preview dd')).toHaveText([/80,00/, /40,00/, /40,00/]);
  await expect(page.locator('.procurement-form:visible')).toHaveCount(1);
  await card.getByRole('button', { name: 'Recolher comanda' }).click();
  await card.getByRole('button', { name: 'Abrir comanda' }).click();
  await expect(card.getByLabel('Valor unitário de galinhas (R$)')).toHaveValue('40');
  const requestsBefore = fixture.requests.filter(path => path === '/api/caixa/encomendas').length;
  await page.getByRole('searchbox', { name: 'Buscar encomendas' }).fill('Bruno');
  await expect(page.locator('.procurement-card')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Buscar encomendas' }).fill('Ana');
  await expect(card.getByLabel('Valor unitário de galinhas (R$)')).toHaveValue('40');
  expect(fixture.requests.filter(path => path === '/api/caixa/encomendas').length).toBe(requestsBefore);
  const standards = await page.locator('.procurement-workspace').evaluate(root => ({
    buttons: [...root.querySelectorAll('button')].every(button => button.classList.contains('cf-btn-3d')),
    fits: root.scrollWidth <= root.clientWidth,
    inputs: [...root.querySelectorAll('input:not([type=checkbox]):not([hidden]), select')].filter(input => input.getBoundingClientRect().height).every(input => input.getBoundingClientRect().height >= 44),
  }));
  expect(standards).toEqual({ buttons: true, fits: true, inputs: true });
  await page.screenshot({ path: testInfo.outputPath('procurement-quote.png'), fullPage: true });
});

test('procurement errors preserve the form, allow retry and keep the signal displayed in reais', async ({ page, fixture }, testInfo) => {
  const intake = fixture.app.locals.orderIntake, phone = '5564999990001';
  await intake.handle({ phone, customerName: 'Ana', message: 'Quero 2 galinhas', messageId: 'ui-error-offer' });
  const saved = await intake.handle({ phone, customerName: 'Ana', message: 'sim', messageId: 'ui-error-confirm' });
  await ready(page); await login(page); await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Encomendas', exact: true }).click();
  const price = page.getByLabel('Valor unitário de galinhas (R$)');
  await price.fill('40');
  await page.getByLabel('Data da chegada do item: galinhas').fill(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  await page.getByLabel('Valores e datas confirmados com o responsável ou fornecedor').check();
  await page.getByLabel('Comercialização permitida conferida').check();
  const failure = route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Atualize a comanda e tente novamente.' }) });
  await page.route('**/api/caixa/encomendas/*/cotacao', failure);
  const submit = page.getByRole('button', { name: 'Confirmar cotação e consultar cliente' });
  await submit.click();
  await expect(page.locator('.procurement-error')).toContainText('Atualize a comanda');
  await expect(price).toHaveValue('40'); await expect(submit).toBeEnabled();
  await page.unroute('**/api/caixa/encomendas/*/cotacao', failure);
  await submit.click();
  await expect(page.locator('.procurement-status')).toHaveText('Aguardando aceite do cliente');
  await expect(page.locator('.procurement-card > .procurement-totals dd')).toHaveText([/80,00/, /40,00/, /40,00/]);
  await intake.handle({ phone, message: 'sim', messageId: 'ui-accept' });
  await page.getByRole('button', { name: 'Atualizar encomendas' }).click();
  await expect(page.locator('.procurement-form-heading h4')).toContainText(/40,00/);
  await page.getByLabel('Forma de pagamento do sinal').selectOption('PIX');
  await expect(page.getByRole('button', { name: 'Confirmar recebimento do sinal' })).toBeDisabled();
  expect((await intake.store.read('orders', saved.requestId)).procurement.deposit).toBeUndefined();
  await page.screenshot({ path: testInfo.outputPath('procurement-signal.png'), fullPage: true });
  await page.getByRole('button', { name: 'Personalizar loja', exact: true }).click();
  await expect(page.locator('.admin-panel')).not.toHaveClass(/procurement-panel/);
});
