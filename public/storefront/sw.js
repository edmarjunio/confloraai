/* BUILD_MANIFEST */
/* Public UI only. API responses and transaction requests never enter CacheStorage. */
const BUILD = self.CONFLORA_BUILD || { version: 'source-v43', core: [] };
const CACHE_NAME = 'conflora-public-shell-' + BUILD.version;
const SHELL_URL = '/storefront/shell.html';
const CORE_FILES = BUILD.core;
const CORE_URLS = new Set(CORE_FILES.map(file => new URL(file, self.location.origin).href));
const isVersioned = path => /^\/storefront\/dist\/versioned\/[\w-]+-(?:[a-f0-9]{16}|[A-Z0-9]{8})\.(?:js|css|png|webp|svg)$/.test(path);

self.addEventListener('install', event => {
  // Let the current tabs finish with their current worker. Never force a reload.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try { await cache.addAll(CORE_FILES); }
    catch (error) { await caches.delete(CACHE_NAME); throw error; }
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
  const asset = isVersioned(url.pathname) && !url.search;
  if (!navigation && !asset) return;
  event.respondWith((async () => {
    const key = navigation ? SHELL_URL : request;
    let cache, saved;
    try {
      cache = await caches.open(CACHE_NAME);
      saved = await cache.match(key);
    } catch { /* Disabled or corrupt storage must still allow an online response. */ }
    if (asset && saved) return saved;
    // Network-first HTML discovers each new hashed release on the next visit.
    // No automatic reload may interrupt a cart or a checkout.
    let response;
    try { response = await fetch(navigation ? SHELL_URL : request); }
    catch (error) { if (saved) return saved; throw error; }
    if (navigation && response.status >= 500 && saved) return saved;
    if (cache && response.ok && !response.redirected &&
        !/no-store|private/i.test(response.headers.get('Cache-Control') || '')) {
      try {
        await cache.put(key, response.clone());
        const keys = await cache.keys();
        const extras = keys.filter(entry => !CORE_URLS.has(entry.url));
        for (const entry of extras.slice(0, Math.max(0, extras.length - 80))) await cache.delete(entry);
      } catch { /* Quota/storage errors must not turn a good response into a failure. */ }
    }
    return response;
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || '/', self.location.origin);
    if (target.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find(entry => entry.url === event.notification.data?.clientUrl);
    if (client) { await client.navigate(target.href); await client.focus(); }
    else await self.clients.openWindow(target.href);
  })());
});
