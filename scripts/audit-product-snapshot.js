// Explicit read-only audit; external requests, when requested, are HEAD to the configured Storage bucket only.
const fs = require('node:fs/promises');
const { normalizeProductMedia, storageObjectPath } = require('../src/catalog/product-media');
const { normalizeProductInformation } = require('../src/catalog/registered-product-content');
const { commercialProduct, hasValidCommercialPrice } = require('../src/catalog/commercial-product');
async function auditSnapshot(snapshot, { verifyStorage = false, fetcher = fetch } = {}) {
  const products = snapshot.products;
  const result = { at: new Date().toISOString(), sourceAt: snapshot.at, mode: 'READ_ONLY', total: products.length,
    active: 0, invalidPrices: [], inactive: [], missingMedia: [], mediaSources: {}, rawImageSources: {},
    descriptionsAbsentInSource: [], descriptionsPendingReview: [], storage: { references: 0, checks: [] } };
  const storage = [];
  for (const product of products) {
    const identity = { id: product.id, name: product.name };
    if (commercialProduct(product).active) result.active++; else result.inactive.push(identity);
    if (!hasValidCommercialPrice(product)) result.invalidPrices.push(identity);
    const media = normalizeProductMedia(product);
    if (media.pending) result.missingMedia.push({ ...identity, reason: 'MEDIA_PROVENANCE_OR_PRODUCT_MATCH_NOT_CONFIRMED' });
    for (const entry of media.entries) result.mediaSources[entry.source] = (result.mediaSources[entry.source] || 0) + 1;
    const url = product.imageUrl || '';
    const location = storageObjectPath(url, product.id) ? 'FIREBASE_STORAGE_REFERENCE' : url.startsWith('/store-assets/') ? 'LOCAL_REFERENCE' : url.startsWith('https:') ? 'EXTERNAL_REFERENCE' : 'MISSING_OR_INVALID';
    result.rawImageSources[location] = (result.rawImageSources[location] || 0) + 1;
    if (location === 'FIREBASE_STORAGE_REFERENCE') storage.push({ ...identity, url });
    if (![product.description, product.descriptionAi, product.publicDescription, product.descricao_ia].some(text => typeof text === 'string' && text.trim())) result.descriptionsAbsentInSource.push(identity);
    if (normalizeProductInformation(product).reviewPending) result.descriptionsPendingReview.push(identity);
  }
  result.storage.references = storage.length;
  if (verifyStorage) for (let offset = 0; offset < storage.length; offset += 8) await Promise.all(storage.slice(offset, offset + 8).map(async item => {
    try {
      const response = await fetcher(item.url, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(10000) });
      result.storage.checks.push({ id: item.id, status: response.status, contentType: response.headers.get('content-type'), bytes: Number(response.headers.get('content-length')) || 0 });
    } catch (error) { result.storage.checks.push({ id: item.id, error: error.name }); }
  }));
  return result;
}
async function main() {
  const [source, output = 'docs/audit/PRODUCT_INTEGRITY-current.json'] = process.argv.slice(2);
  if (!source) throw new Error('Informe o snapshot privado de produtos.');
  const result = await auditSnapshot(JSON.parse(await fs.readFile(source, 'utf8')), { verifyStorage: process.argv.includes('--verify-storage') });
  await fs.writeFile(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ total: result.total, active: result.active, invalidPrices: result.invalidPrices.length, missingMedia: result.missingMedia.length,
    descriptionsPendingReview: result.descriptionsPendingReview.length, rawImageSources: result.rawImageSources, storageChecks: result.storage.checks.length }));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { auditSnapshot };
