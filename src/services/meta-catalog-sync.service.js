const { createHash } = require('node:crypto');
const { PdvRepository } = require('../orders/pdv.repository');
const { commercialProduct } = require('../catalog/commercial-product');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const restrictedCategory = value => /\b(animal|animais|ave|aves|galinha|galo|pintinho|peixe|gado|livestock|agrotoxico|veneno|arma|tabaco|medicamento)\b/.test(require('../shared/string.util').normalizeText(value));
function eligibleForMeta(raw) {
  const review = raw?.metaCommerceReview;
  return Boolean(review?.approved === true && review?.reviewedBy && review?.reviewedAt && review?.policyVersion && review?.category === 'PERMITTED_PLANT_OR_GARDEN_PRODUCT' &&
    !restrictedCategory([raw.name, raw.category, raw.subcategory, raw.descricao].join(' ')));
}
function projection(raw, id, storeUrl) {
  if (!raw || !eligibleForMeta(raw) || !commercialProduct(raw).active) return { retailer_id: id, availability: 'discontinued' };
  const product = commercialProduct(raw);
  const image = raw.images?.[0]?.url || raw.images?.[0] || raw.imageUrl;
  const description = String(raw.publicDescription || raw.description || product.name).trim();
  if (!/^[a-zA-Z0-9_-]{1,180}$/.test(id) || !Number.isSafeInteger(product.priceMinor) || product.priceMinor <= 0 || !/^https:\/\//.test(image || '') || !/^https:\/\//.test(storeUrl || '') || !description) throw new Error('Produto sem campos públicos válidos para sincronização Meta.');
  return { retailer_id: id, name: product.name.slice(0, 200), description: description.slice(0, 5000),
    price: product.priceMinor, currency: 'BRL', image_url: image, url: storeUrl,
    availability: product.stockQuantity - product.reservedQuantity >= product.saleUnit.minimum ? 'in stock' : 'out of stock', condition: 'new' };
}
class MetaCatalogSyncService {
  constructor(repository) { this.repository = repository; this.store = new PdvRepository(repository); }
  async queue(productId, actor) {
    if (!/^[a-zA-Z0-9_-]{1,180}$/.test(productId)) throw new Error('Produto inválido.');
    const id = 'meta-product-' + hash(productId);
    await this.store.transaction(async tx => {
      const old = await tx.get('pdv_outbox', id);
      const generation = Number(old?.requestedGeneration || 0) + 1;
      tx.set('pdv_outbox', id, { ...old, id, kind: 'meta-product-sync', productId, requestedGeneration: generation,
        status: old?.leaseUntil > Date.now() ? old.status : 'PENDING', attempts: old?.leaseUntil > Date.now() ? old.attempts : 0,
        nextAttemptAt: 0, updatedAt: new Date().toISOString(), requestedBy: actor?.id || 'product-trigger' });
    });
    return id;
  }
  async request(path, { method = 'GET', data } = {}) {
    const config = require('../config/env').whatsapp;
    const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${path}`, { method,
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(`Sincronização Meta recusada (HTTP ${response.status}).`);
    return result;
  }
  async deliver(job) {
    const settings = await this.store.read('store_settings', 'whatsapp_commerce');
    if (process.env.WHATSAPP_META_SYNC_ENABLED !== 'true' || !settings?.initialSyncAuthorizedAt || settings?.enabled !== true) {
      await this.store.updateMessage(job.id, { status: 'BLOCKED_CONFIGURATION', leaseUntil: 0, lastError: 'INITIAL_SYNC_NOT_AUTHORIZED' }, job.leaseOwner); return;
    }
    const catalogId = process.env.WHATSAPP_META_CATALOG_ID;
    if (!/^\d+$/.test(catalogId || '') || settings.catalogId !== catalogId) throw new Error('Catálogo autorizado não confere.');
    // Events carry identity only. Always read the current backend version, including deletion.
    const raw = await this.repository.getProductById(job.productId);
    const data = projection(raw, job.productId, require('../config/env').whatsapp.catalogUrl);
    const fingerprint = hash(data);
    const filter = encodeURIComponent(JSON.stringify({ retailer_id: { eq: job.productId } }));
    const found = await this.request(`${catalogId}/products?fields=id,retailer_id&filter=${filter}&limit=2`);
    if (!Array.isArray(found.data) || found.data.length > 1) throw new Error('Identidade Meta ambígua.');
    if (found.data[0]) await this.request(found.data[0].id, { method: 'POST', data });
    else if (data.availability !== 'discontinued') await this.request(`${catalogId}/products`, { method: 'POST', data });
    const latest = projection(await this.repository.getProductById(job.productId), job.productId, require('../config/env').whatsapp.catalogUrl);
    await this.store.transaction(async tx => {
      const current = await tx.get('pdv_outbox', job.id);
      if (current?.leaseOwner !== job.leaseOwner) throw new Error('Posse da sincronização alterada.');
      const changed = hash(latest) !== fingerprint || current.requestedGeneration !== job.requestedGeneration;
      tx.set('pdv_outbox', job.id, { ...current, status: changed ? 'PENDING' : 'SENT', attempts: 0, leaseUntil: 0,
        syncedFingerprint: fingerprint, syncedAt: new Date().toISOString(), lastError: '' });
    });
  }
}
module.exports = { MetaCatalogSyncService, eligibleForMeta, projection };
