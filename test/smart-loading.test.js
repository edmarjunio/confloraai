const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { dispatch } = require('./helpers/in-process-http');

function worker({ failNetwork = false, failStorage = false, failInstall = false, failOpen = false, failMatch = false } = {}) {
  const handlers = new Map(), records = new Map(), deleted = [], calls = [];
  const cache = {
    async match(key) { if (failMatch) throw new Error('corrupt storage'); return records.get(typeof key === 'string' ? key : key.url)?.clone(); },
    async put(key, response) { if (failStorage) throw new Error('quota'); records.set(typeof key === 'string' ? key : key.url, response.clone()); },
    async keys() { return [...records.keys()].map(key => ({ url: new URL(key, 'https://conflora.test').href })); },
    async delete(request) { records.delete(request.url); },
    async addAll() { if (failInstall) throw new Error('install failed'); },
  };
  vm.runInNewContext(fs.readFileSync('public/storefront/sw.js', 'utf8'), {
    self: { CONFLORA_BUILD: { version: 'test', core: ['/storefront/shell.html'] }, location: { origin: 'https://conflora.test' },
      addEventListener: (name, handler) => handlers.set(name, handler), clients: { claim: async () => {}, matchAll: async () => [] } },
    caches: { open: async () => { if (failOpen) throw new Error('storage disabled'); return cache; }, keys: async () => ['unrelated', 'conflora-public-shell-old', 'conflora-public-shell-test'], delete: async key => deleted.push(key) },
    URL, fetch: async request => { calls.push(request); if (failNetwork) throw new Error('offline'); return new Response('new shell', { headers: { 'Cache-Control': 'no-cache' } }); },
  });
  const fetch = (path, { method = 'GET', mode = 'cors' } = {}) => {
    let response;
    handlers.get('fetch')({ request: { url: 'https://conflora.test' + path, method, mode }, respondWith: value => { response = value; } });
    return response;
  };
  return { handlers, records, deleted, calls, fetch };
}

test('worker caches only hashed UI; private, payment and mutable assets remain network-only', async () => {
  const instance = worker();
  for (const path of ['/api/storefront/catalog', '/api/auth/me', '/api/customer/orders', '/api/images/photo', '/admin', '/caixa', '/store-assets/v5/app.js', '/storefront/dist/spending-chart.js']) {
    assert.equal(instance.fetch(path), undefined, path);
  }
  assert.equal(instance.fetch('/storefront/dist/versioned/app-ABCDEFGH.js', { method: 'POST' }), undefined);
  assert.equal(instance.fetch('/storefront/dist/versioned/app-ABCDEFGH.js?token=private'), undefined);
  const asset = '/storefront/dist/versioned/app-ABCDEFGH.js';
  await instance.fetch(asset);
  await instance.fetch(asset);
  assert.equal(instance.calls.length, 1);
  assert.equal(instance.records.size, 1);
});

test('worker revalidates HTML, falls back offline and tolerates cache quota failures', async () => {
  const online = worker();
  online.records.set('/storefront/shell.html', new Response('old shell'));
  assert.equal(await (await online.fetch('/', { mode: 'navigate' })).text(), 'new shell');
  const offline = worker({ failNetwork: true });
  offline.records.set('/storefront/shell.html', new Response('safe offline shell'));
  assert.equal(await (await offline.fetch('/products/p', { mode: 'navigate' })).text(), 'safe offline shell');
  const full = worker({ failStorage: true });
  assert.equal(await (await full.fetch('/storefront/dist/versioned/app-ABCDEFGH.js')).text(), 'new shell');
});

test('failed worker install is removed; activation only deletes prior Conflora caches', async () => {
  const failed = worker({ failInstall: true });
  let install;
  failed.handlers.get('install')({ waitUntil: task => { install = task; } });
  await assert.rejects(install, /install failed/);
  assert.deepEqual(failed.deleted, ['conflora-public-shell-test']);
  const active = worker(); let activation;
  active.handlers.get('activate')({ waitUntil: task => { activation = task; } });
  await activation;
  assert.deepEqual(active.deleted, ['conflora-public-shell-old']);
});

test('worker keeps public navigation and hashed assets online when cache opening or matching fails', async () => {
  for (const options of [{ failOpen: true }, { failMatch: true }]) {
    const instance = worker(options);
    assert.equal(await (await instance.fetch('/', { mode: 'navigate' })).text(), 'new shell');
    assert.equal(await (await instance.fetch('/storefront/dist/versioned/app-ABCDEFGH.js')).text(), 'new shell');
    assert.equal(instance.calls.length, 2);
    assert.equal(instance.fetch('/api/customer/orders'), undefined);
  }
});

test('built shell uses immutable hashes; mutable HTML, manifests and API keep revalidation boundaries', { skip: !fs.existsSync('public/storefront/dist/manifest.json') }, async () => {
  const { createApp } = require('../src/http/app');
  const { FirestoreRepository } = require('../src/database/firestore.repository');
  const repository = new FirestoreRepository({ isInMemory: true });
  const app = createApp({ messageService: { firestoreRepo: repository, catalogRepo: { items: [], refreshCatalog: async () => {} } } });
  const manifest = JSON.parse(fs.readFileSync('public/storefront/dist/manifest.json'));
  for (const asset of manifest.core.filter(file => file !== '/storefront/shell.html')) {
    const response = await dispatch(app, 'https://conflora.test' + asset);
    assert.equal(response.status, 200, asset);
    assert.match(response.headers.get('cache-control'), /immutable/, asset);
  }
  for (const asset of ['/store-assets/v5/app.js', '/storefront/shell.html', '/storefront/sw.js', '/storefront/dist/manifest.json']) {
    const response = await dispatch(app, 'https://conflora.test' + asset);
    assert.equal(response.status, 200, asset);
    assert.doesNotMatch(response.headers.get('cache-control'), /immutable/);
  }
  const publicResponse = await dispatch(app, 'https://conflora.test/api/storefront/catalog');
  assert.match(publicResponse.headers.get('cache-control'), /no-store/);
  const html = await (await dispatch(app, 'https://conflora.test/')).text();
  assert.ok(html.includes(manifest.app));
  assert.ok(!manifest.core.some(file => /api\/|admin-|product-entry-|product-info-content-/.test(file)));
  const hosting = JSON.parse(fs.readFileSync('firebase.json')).hosting;
  const publicHtml = hosting.headers.find(rule => rule.regex);
  for (const path of ['/', '/products/p', '/shop/garden', '/shop/garden/products/p', '/configuracoes']) {
    assert.ok(new RegExp(publicHtml.regex).test(path));
    assert.match(publicHtml.headers[0].value, /must-revalidate/);
  }
  assert.equal(hosting.rewrites.find(rule => rule.source === '/storefront/sw.js').destination, '/storefront/sw-built.js');
  assert.ok(hosting.ignore.includes('storefront/sw.js'));
});
