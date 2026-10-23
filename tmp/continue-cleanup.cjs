const fs = require('node:fs');
const target = 'src/integrations/whatsapp.client.js';
let source = fs.readFileSync(target, 'utf8');
source = source.replace(/    if \(!this\.token \|\| !config\.whatsapp\.phoneNumberId\) \{\r?\n      Logger\.info\([^\n]+\);\r?\n      return \{ mock: true, success: true \};\r?\n    \}/g, '');
source = source.replace('return { mock: true };', "return { skipped: true, reason: 'not_configured_or_missing_id' };");
source = source.replace('return { mock: true, skippedNonMetaId: true };', "return { skipped: true, reason: 'invalid_message_id' };");
source = source.replace('  async postRequest(endpoint, body) {', `  async postRequest(endpoint, body) {
    if (!this.token || !config.whatsapp.phoneNumberId) {
      throw Object.assign(new Error('WhatsApp não configurado.'), { status: 503, definitelyNotSent: true });
    }`);
if (source.includes('WhatsApp Mock') || source.includes('Template Mock')) throw new Error('Unremoved provider simulation.');
fs.writeFileSync(target, source);
const workerPath = 'public/storefront/sw.js';
const previous = fs.readFileSync(workerPath, 'utf8');
const notificationHandler = previous.slice(previous.indexOf("self.addEventListener('notificationclick'"));
fs.writeFileSync(workerPath, `/* BUILD_MANIFEST */
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
` + notificationHandler);
