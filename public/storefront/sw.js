/* Bump this version whenever the application shell changes before publishing. */
const CACHE_NAME = 'conflora-public-shell-v2';
const SHELL_URL = '/storefront/index.html';
const CORE_FILES = [
  SHELL_URL,
  '/store-assets/v5/store.css', '/store-assets/site-header.css',
  '/store-assets/design-system.css', '/store-assets/brands/conflora-logo.png',
  '/store-assets/render-image.js', '/store-assets/product-card.js',
  ...['app.js', 'ui.js', 'catalog.js', 'cart.js', 'cart-storage.mjs',
    'public-cache.mjs', 'chat.js', 'admin.js', 'existing-api.js',
    'product-entry.js', 'icons.js', 'receipt.js', 'guided-search.mjs',
    'guided-chat.js', 'ai-chat.js', 'product-info-content.js', 'team-drawer.js',
    'store/index.js', 'store/zustand.js', 'query/tanstackQuery.js',
    'i18n/index.js', 'i18n/pt.js', 'i18n/en.js', 'i18n/es.js', 'i18n/fr.js',
  ].map(file => '/store-assets/v5/' + file),
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Install atomically: an incomplete new shell must not replace the old one.
    await cache.addAll(CORE_FILES);
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('conflora-public-shell-') && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

function isPublicNavigation(path) {
  return path === '/' || /^\/products\/[^/]+\/?$/.test(path) ||
    /^\/shop\/[^/]+(?:\/products\/[^/]+)?\/?$/.test(path);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navigation = request.mode === 'navigate' && isPublicNavigation(url.pathname);
  const asset = /^\/(store-assets|storefront)\//.test(url.pathname) &&
    /\.(?:js|mjs|css|png|jpg|jpeg|webp|svg|woff2)$/.test(url.pathname) &&
    !url.pathname.endsWith('/sw.js');
  if (!navigation && !asset) return;

  const key = navigation ? SHELL_URL : request;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const saved = await cache.match(key);
    if (saved) return saved;
    // Static UI is versioned with this worker. New releases install in the
    // background, then activate after existing tabs close; avoid mixed modules.
    const response = await fetch(navigation ? SHELL_URL : request);
    if (response.ok && !response.redirected &&
        !/no-store|private/i.test(response.headers.get('Cache-Control') || '')) {
      await cache.put(key, response.clone());
      const keys = await cache.keys();
      // Bound storage growth while preserving the preloaded shell.
      const extras = keys.filter(entry => !CORE_FILES.includes(new URL(entry.url).pathname));
      for (const entry of extras.slice(0, Math.max(0, keys.length - 160))) await cache.delete(entry);
    }
    return response;
  })());
});
