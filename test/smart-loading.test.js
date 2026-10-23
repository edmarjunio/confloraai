const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { dispatch } = require('./helpers/in-process-http');

test('notification worker deletes all old Conflora caches and never intercepts requests', async () => {
  const handlers = new Map(), deleted = [];
  vm.runInNewContext(fs.readFileSync('public/storefront/sw.js', 'utf8'), {
    self: { addEventListener: (name, handler) => handlers.set(name, handler), skipWaiting: async () => {},
      clients: { claim: async () => {} } },
    caches: { keys: async () => ['unrelated', 'conflora-old', 'conflora-public-shell-test'], delete: async key => deleted.push(key) },
  });
  assert.equal(handlers.has('fetch'), false);
  assert.equal(handlers.has('notificationclick'), true);
  let activation;
  handlers.get('activate')({ waitUntil: value => { activation = value; } });
  await activation;
  assert.deepEqual(deleted, ['conflora-old', 'conflora-public-shell-test']);
});

test('built shell uses immutable hashes; mutable HTML, manifests and API keep revalidation boundaries', { skip: !fs.existsSync('public/storefront/dist/manifest.json') }, async () => {
  const { createApp } = require('../src/http/app');
  const { FirestoreRepository } = require('./helpers/repository-fixture');
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
