/** Controlled real catalog publication. No customer messages, orders or stock writes. */
const fs = require('node:fs/promises');
const path = require('node:path');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { MetaCatalogSyncService, eligibleForMeta, projection } = require('../src/services/meta-catalog-sync.service');
const { PdvService } = require('../src/orders/pdv.service');

async function main() {
  const file = process.argv.find(arg => arg.startsWith('--manifest='))?.slice(11);
  if (!file) throw new Error('Informe --manifest=caminho.json; padrão é somente leitura.');
  const manifest = JSON.parse(await fs.readFile(path.resolve(file), 'utf8'));
  const ids = [...new Set(manifest.productIds || [])];
  if (!ids.length || ids.length > 1000 || ids.some(id => !/^[a-zA-Z0-9_-]{1,180}$/.test(id))) throw new Error('Manifesto inválido.');
  const repository = new FirestoreRepository();
  const sync = new MetaCatalogSyncService(repository);
  const inventory = await repository.getInventorySettings();
  const products = await repository.getProductsByIds(ids.slice(0, 150));
  for (let start = 150; start < ids.length; start += 150) products.push(...await repository.getProductsByIds(ids.slice(start, start + 150)));
  const config = require('../src/config/env');
  const report = products.map(product => {
    try { return { id: product.id, eligible: eligibleForMeta(product), projection: projection(product, product.id, config.whatsapp.catalogUrl, inventory) }; }
    catch (error) { return { id: product.id, eligible: false, error: error.message }; }
  });
  console.log(JSON.stringify({ apply: process.argv.includes('--apply'), catalogId: process.env.WHATSAPP_META_CATALOG_ID, stockControlEnabled: inventory.stockControlEnabled, requested: ids.length, found: products.length, eligible: report.filter(row => row.eligible).length }));
  if (!process.argv.includes('--apply')) { console.log(JSON.stringify(report, null, 2)); return; }
  if (process.env.WHATSAPP_META_SYNC_ENABLED !== 'true') throw new Error('WHATSAPP_META_SYNC_ENABLED não habilitado.');
  const settings = await sync.store.read('store_settings', 'whatsapp_commerce');
  if (!settings?.enabled || !settings.initialSyncAuthorizedAt || settings.catalogId !== process.env.WHATSAPP_META_CATALOG_ID) throw new Error('Sincronização inicial ainda não autorizada para este catálogo.');
  // Validate the intended external asset before queuing any writes.
  const linked = await sync.request(`${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/product_catalogs?fields=id,name`);
  if (!linked.data?.some(catalog => catalog.id === settings.catalogId)) throw new Error('Catálogo não vinculado à WABA configurada.');
  const worker = new PdvService({ repository: sync.store });
  const results = [];
  const pending = [...report];
  const concurrency = Math.max(1, Math.min(3, Number(process.argv.find(arg => arg.startsWith('--concurrency='))?.split('=')[1]) || 1));
  async function next() {
    while (pending.length) {
    const row = pending.shift();
    if (row.error) { results.push(row); continue; }
    const id = await sync.queue(row.id, { id: 'authorized-catalog-maintenance' });
    // Uses the existing lease, retry policy and reconciliation; never drains unrelated messages.
    await worker.deliver(id);
    const job = await sync.store.read('pdv_outbox', id);
    results.push({ productId: row.id, id, status: job.status, error: job.lastError || '', syncedAt: job.syncedAt || null });
    console.log(JSON.stringify(results.at(-1)));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
  const reportPath = path.resolve('.private/whatsapp-diagnostics/catalog-sync-result.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify({ at: new Date().toISOString(), catalogId: settings.catalogId, results }, null, 2));
  if (results.some(row => row.error || row.status !== 'SENT')) process.exitCode = 1;
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
