// Operator-invoked, read-only full reconciliation; never loaded by web requests.
const fs = require('node:fs/promises');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { actualProductImages } = require('../src/catalog/actual-product-photo');
const { normalizeCatalogItem } = require('../src/catalog/normalize-catalog-item');
const { toProduct } = require('../src/storefront/existing-store');
const { commercialProduct, hasValidCommercialPrice } = require('../src/catalog/commercial-product');

async function main() {
  const repo = new FirestoreRepository();
  const products = await repo.getAllProducts();
  const inventory = await repo.getInventorySettings();
  const ids = new Set();
  const failures = [];
  const photosPending = [];
  let storedReferenceCount = 0;
  const storageChecks = [];
  for (const product of products) {
    const issues = [];
    if (!product.id || ids.has(product.id)) issues.push('IDENTIDADE_AUSENTE_OU_DUPLICADA');
    ids.add(product.id);
    if (!commercialProduct(product).name?.trim()) issues.push('NOME_AUSENTE');
    if (!hasValidCommercialPrice(product)) issues.push('PRECO_INVALIDO');
    const images = actualProductImages(product);
    if (!images.length) photosPending.push({ id: product.id, name: product.name, reason: 'FOTO_REAL_NAO_CONFIRMADA' });
    if (String(product.imageUrl).startsWith('https://firebasestorage.googleapis.com/')) storedReferenceCount++;
    const catalog = normalizeCatalogItem(product);
    const storefront = toProduct(product, inventory);
    if (catalog.price !== storefront.price.amountMinor / 100) issues.push('DIVERGENCIA_PRECO_NA_PROJECAO');
    if (catalog.imageUrl !== (images[0] || '') || storefront.imageUrl !== (images[0] || '')) issues.push('DIVERGENCIA_FOTO_NA_PROJECAO');
    if (issues.length) failures.push({ id: product.id, name: product.name, issues });
  }
  if (process.argv.includes('--verify-storage')) {
    const stored = products.filter(product => String(product.imageUrl).startsWith('https://firebasestorage.googleapis.com/'));
    for (let offset = 0; offset < stored.length; offset += 8) await Promise.all(stored.slice(offset, offset + 8).map(async product => {
      try {
        const response = await fetch(product.imageUrl, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(10000) });
        storageChecks.push({ id: product.id, status: response.status, contentType: response.headers.get('content-type'), bytes: Number(response.headers.get('content-length')) || 0 });
      } catch (error) { storageChecks.push({ id: product.id, error: error.name }); }
    }));
  }
  const report = { at: new Date().toISOString(), mode: 'READ_ONLY', source: 'Firestore products', count: products.length,
    stockControlEnabled: inventory.stockControlEnabled, confirmedActualPhotoCount: products.length - photosPending.length,
    storagePrimaryReferenceCount: storedReferenceCount, note: 'Storage reference is not proof of ownership, actual-product provenance, or object accessibility.',
    failureCount: failures.length, failures, photosPending, storageChecks };
  await fs.writeFile('docs/PRODUCT_INTEGRITY-2026-10-24.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, failures: report.failures, photosPending: report.photosPending.length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
