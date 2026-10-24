const { createHash } = require('node:crypto');
const { PdvRepository } = require('../orders/pdv.repository');
const { commercialProduct } = require('../catalog/commercial-product');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const { normalizeText } = require('../shared/string.util');
const internalProduct = require('../catalog/commercial-product').isInternalFinancialProduct;
const policyIdentity = raw => hash([raw?.name, raw?.category, raw?.subcategory].map(value => normalizeText(value || '')));
const restrictedCategory = value => /\b(animal|animais|aves?|galinhas?|galos?|pintinhos?|peixes?|codornas?|papagaios?|caes|cachorros?|gatos?|gado|livestock|agrotoxicos?|venenos?|armas?|tabaco|medicamentos?)\b/.test(require('../shared/string.util').normalizeText(value));
function restrictedProduct(raw) {
  let text = [raw?.name, raw?.category, raw?.subcategory, raw?.descricao].map(value => normalizeText(value || '')).join(' ');
  if (normalizeText(raw?.category || '') === 'plantas mudas') {
    // Exact established ornamental names are not live animals. Ambiguous names still require review.
    text = text.replace(/\b(rabo de gato|bico de papagaio|crista de galo)\b/g, 'planta ornamental');
  }
  return restrictedCategory(text);
}
function eligibleForMeta(raw) {
  const review = raw?.metaCommerceReview;
  return Boolean(require('../catalog/actual-product-photo').actualProductImages(raw).length && !internalProduct(raw) && normalizeText(raw?.category || '') !== 'pets' && review?.approved === true && (!review.productIdentity || review.productIdentity === policyIdentity(raw)) && review?.reviewedBy && review?.reviewedAt && review?.policyVersion && review?.category === 'PERMITTED_PLANT_OR_GARDEN_PRODUCT' &&
    !restrictedProduct(raw));
}
function projection(raw, id, storeUrl, inventory = { stockControlEnabled: true }) {
  if (!raw || !eligibleForMeta(raw) || !commercialProduct(raw).active) return { retailer_id: id, availability: 'discontinued' };
  const product = commercialProduct(raw);
  const image = require('../catalog/actual-product-photo').actualProductImages(raw)[0];
  const baseDescription = require('../catalog/registered-product-content').registeredProductContent(raw).description;
  const media = require('../catalog/product-media').normalizeProductMedia(raw).entries[0];
  const credit = media?.provenance.license?.attribution ? `${media.provenance.license.attribution} ${media.provenance.license.url}` : '';
  const description = credit ? `${baseDescription.slice(0, Math.max(0, 4999 - credit.length))}\n${credit}` : baseDescription;
  if (!/^[a-zA-Z0-9_-]{1,180}$/.test(id) || !Number.isSafeInteger(product.priceMinor) || product.priceMinor <= 0 || !/^https:\/\//.test(image || '') || !/^https:\/\//.test(storeUrl || '') || !description) throw new Error('Produto sem campos públicos válidos para sincronização Meta.');
  return { retailer_id: id, name: product.name.slice(0, 200), description: description.slice(0, 5000),
    price: product.priceMinor, currency: 'BRL', image_url: image, url: storeUrl,
    availability: inventory.stockControlEnabled === false || product.stockQuantity - product.reservedQuantity >= product.saleUnit.minimum ? 'in stock' : 'out of stock', condition: 'new' };
}
class MetaCatalogSyncService {
  constructor(repository) { this.repository = repository; this.store = new PdvRepository(repository); }
  async queue(productId, actor, { sourceFingerprint } = {}) {
    if (!/^[a-zA-Z0-9_-]{1,180}$/.test(productId)) throw new Error('Produto inválido.');
    if (sourceFingerprint !== undefined && !/^[a-f0-9]{64}$/.test(sourceFingerprint)) throw new Error('Versão da projeção inválida.');
    const id = 'meta-product-' + hash(productId);
    await this.store.transaction(async tx => {
      const old = await tx.get('pdv_outbox', id);
      if (sourceFingerprint && old?.requestedSourceFingerprint === sourceFingerprint && ['SENT', 'CATALOG_PENDING'].includes(old.status)) return;
      const generation = Number(old?.requestedGeneration || 0) + 1;
      tx.set('pdv_outbox', id, { ...old, id, kind: 'meta-product-sync', productId, requestedGeneration: generation,
        status: old?.leaseUntil > Date.now() ? old.status : 'CATALOG_PENDING', attempts: old?.leaseUntil > Date.now() ? old.attempts : 0,
        nextAttemptAt: 0, updatedAt: new Date().toISOString(), requestedBy: actor?.id || 'product-trigger',
        ...(sourceFingerprint ? { requestedSourceFingerprint: sourceFingerprint } : {}) });
    });
    return id;
  }
  async request(path, { method = 'GET', data } = {}) {
    const config = require('../config/env').whatsapp;
    const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${path}`, { method,
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok || result.error) {
      const code = Number(result.error?.code) || 0;
      const subcode = Number(result.error?.error_subcode) || 0;
      // Never persist Graph bodies, URLs with access tokens, or credentials in the outbox.
      throw Object.assign(new Error(`Sincronização Meta recusada (HTTP ${response.status}; código ${code}; subcódigo ${subcode}).`), { providerCode: code, providerSubcode: subcode });
    }
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
    const inventory = await this.repository.getInventorySettings();
    const data = projection(raw, job.productId, require('../config/env').whatsapp.catalogUrl, inventory);
    const fingerprint = hash(data);
    if (job.syncedFingerprint !== fingerprint || job.syncedCatalogId !== catalogId) {
      const filter = encodeURIComponent(JSON.stringify({ retailer_id: { eq: job.productId } }));
      const found = await this.request(`${catalogId}/products?fields=id,retailer_id&filter=${filter}&limit=2`);
      if (!Array.isArray(found.data) || found.data.length > 1) throw new Error('Identidade Meta ambígua.');
      const lease = await this.store.read('pdv_outbox', job.id);
      if (lease?.leaseOwner !== job.leaseOwner || !(lease.leaseUntil > Date.now())) throw new Error('Posse da sincronização expirada.');
      if ((await this.store.read('store_settings', 'whatsapp_commerce'))?.enabled !== true) throw new Error('Sincronização pausada pela equipe.');
      if (found.data[0]) {
        const changes = { ...data }; delete changes.retailer_id;
        await this.request(found.data[0].id, { method: 'POST', data: changes });
      } else if (data.availability !== 'discontinued') await this.request(`${catalogId}/products`, { method: 'POST', data });
    }
    const latest = projection(await this.repository.getProductById(job.productId), job.productId, require('../config/env').whatsapp.catalogUrl, await this.repository.getInventorySettings());
    await this.store.transaction(async tx => {
      const current = await tx.get('pdv_outbox', job.id);
      if (current?.leaseOwner !== job.leaseOwner) throw new Error('Posse da sincronização alterada.');
      const changed = hash(latest) !== fingerprint || current.requestedGeneration !== job.requestedGeneration;
      tx.set('pdv_outbox', job.id, { ...current, status: changed ? 'CATALOG_PENDING' : 'SENT', attempts: 0, leaseUntil: 0,
        syncedFingerprint: fingerprint, syncedCatalogId: catalogId, syncedAt: new Date().toISOString(), lastError: '' });
    });
  }
}
module.exports = { MetaCatalogSyncService, eligibleForMeta, projection, restrictedCategory, restrictedProduct, internalProduct, policyIdentity };
