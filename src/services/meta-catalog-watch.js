const { MetaCatalogSyncService, eligibleForMeta, projection } = require('./meta-catalog-sync.service');
const Logger = require('../shared/logger');
const { createHash } = require('node:crypto');

/** Local test event source; delivery still uses the official pdv_outbox/worker.
 * Hosted operation uses the Firestore trigger, never both sources by default.
 */
function watchMetaCatalog(repository, { onError = error => Logger.error('Observação local do catálogo Meta interrompida.', error), sync = new MetaCatalogSyncService(repository) } = {}) {
  if (process.env.NODE_ENV === 'production' || process.env.WHATSAPP_META_LOCAL_WATCH_ENABLED !== 'true' || !repository.firestore) return () => {};
  const published = new Set();
  const observed = new Map();
  const storeUrl = require('../config/env').whatsapp.catalogUrl;
  let chain = Promise.resolve();
  let stopped = false;
  const unsubscribe = repository.firestore.collection('products').onSnapshot(snapshot => {
    chain = chain.then(async () => {
      if (stopped) return;
      const settings = await sync.store.read('store_settings', 'whatsapp_commerce');
      if (!settings?.enabled || !settings.initialSyncAuthorizedAt) return;
      for (const change of snapshot.docChanges()) {
        if (stopped) return;
        const id = change.doc.id;
        const raw = change.type === 'removed' ? null : { ...change.doc.data(), id };
        const approved = Boolean(raw && eligibleForMeta(raw));
        let fingerprint;
        try { fingerprint = JSON.stringify(projection(raw, id, storeUrl)); }
        catch { fingerprint = JSON.stringify([raw?.name, raw?.category, raw?.price, raw?.imageUrl, raw?.images, raw?.publicDescription, raw?.description, raw?.status]); }
        fingerprint = createHash('sha256').update(fingerprint).digest('hex');
        if (observed.get(id) === fingerprint) continue;
        if (approved || published.has(id)) {
          await sync.queue(id, { id: 'local-firestore-watch' }, { sourceFingerprint: fingerprint });
          if (approved) published.add(id); else published.delete(id);
        }
        if (raw) observed.set(id, fingerprint); else observed.delete(id);
      }
    }).catch(onError);
  }, onError);
  return () => { stopped = true; unsubscribe(); };
}

module.exports = { watchMetaCatalog };
