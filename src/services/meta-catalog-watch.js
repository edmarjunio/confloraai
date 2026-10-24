const { MetaCatalogSyncService, eligibleForMeta } = require('./meta-catalog-sync.service');
const Logger = require('../shared/logger');

/** Local test event source; delivery still uses the official pdv_outbox/worker.
 * Hosted operation uses the Firestore trigger, never both sources by default.
 */
function watchMetaCatalog(repository, { onError = error => Logger.error('Observação local do catálogo Meta interrompida.', error), sync = new MetaCatalogSyncService(repository) } = {}) {
  if (process.env.NODE_ENV === 'production' || process.env.WHATSAPP_META_LOCAL_WATCH_ENABLED !== 'true' || !repository.firestore) return () => {};
  const published = new Set();
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
        const approved = change.type !== 'removed' && eligibleForMeta(change.doc.data());
        if (approved || published.has(id)) {
          await sync.queue(id, { id: 'local-firestore-watch' });
          if (approved) published.add(id); else published.delete(id);
        }
      }
    }).catch(onError);
  }, onError);
  return () => { stopped = true; unsubscribe(); };
}

module.exports = { watchMetaCatalog };
