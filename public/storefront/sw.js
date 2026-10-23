/* BUILD_MANIFEST */
// Notification worker only. Every response comes from the network.
async function removeOldCaches() {
  for (const name of await caches.keys()) {
    if (name.startsWith('conflora')) await caches.delete(name);
  }
}
self.addEventListener('install', event => {
  event.waitUntil(removeOldCaches().then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(removeOldCaches().then(() => self.clients.claim()));
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
