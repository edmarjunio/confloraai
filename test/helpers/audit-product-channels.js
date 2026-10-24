// Local audit worker. No credentials, sockets, workers or external writes.
require('../../scripts/test-env');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { FirestoreRepository } = require('./repository-fixture');
const { dispatch } = require('./in-process-http');
const { createApp } = require('../../src/http/app');
const { normalizeCatalogItem } = require('../../src/catalog/normalize-catalog-item');
const { commercialProduct, isInternalFinancialProduct } = require('../../src/catalog/commercial-product');
const { projection } = require('../../src/services/meta-catalog-sync.service');

const fingerprint = value => createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
const present = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'object' || Object.keys(value).length > 0);
function fields(product, channel) {
  if (!product) return null;
  const raw = channel === 'firestore';
  const price = raw ? commercialProduct(product).price : typeof product.price === 'object' ? product.price.amountMinor / 100 : product.price;
  return { id: product.id, sku: product.sku || '', name: product.name, category: product.categoryName || product.category || '', price,
    stock: raw ? { physical: product.stockQuantity, reserved: product.reservedQuantity || 0 } : product.stock,
    description: product.description || product.descriptionAi || '', specifications: product.productInfo?.specifications || product.specifications || product.details?.filter(row => row.label === 'Especificações') || {},
    primaryImage: product.imageUrl || '', secondaryImages: (product.images || []).filter(url => url !== product.imageUrl),
    care: product.productInfo?.attributes?.filter(row => row.key === 'care') || product.careInstructions || product.cuidados_basicos || '',
    variation: product.variation || product.variacao || '', productInfo: product.productInfo || null };
}
async function main() {
  const [sourceFile, prefix = 'docs/audit/PRODUCT_CHANNELS-before'] = process.argv.slice(2);
  if (!sourceFile) throw new Error('Provide a private products-only snapshot.');
  const snapshot = JSON.parse(await fs.readFile(sourceFile, 'utf8'));
  const repo = new FirestoreRepository({ isInMemory: true });
  for (const product of snapshot.products) repo.inMemoryProducts.set(product.id, product);
  if (snapshot.storefront) repo.storefrontSettings = snapshot.storefront;
  repo.getInventorySettings = async () => snapshot.inventory;
  const app = createApp({ messageService: { firestoreRepo: repo, catalogRepo: { items: [], invalidateCache() {} } } });
  const login = await dispatch(app, '/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'usr-edmar', pin: '1234' }) });
  if (login.status !== 200) throw new Error('Isolated audit authentication failed.');
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const routeMetrics = [];
  const read = async url => {
    const started = performance.now();
    const response = await dispatch(app, url, { headers: { cookie } });
    if (response.status !== 200) throw new Error(`Audit route failed: ${url}; HTTP ${response.status}`);
    const body = await response.text();
    routeMetrics.push({ url, bytes: Buffer.byteLength(body), elapsedMs: Number((performance.now() - started).toFixed(2)), environment: 'ISOLATED_IN_PROCESS_HTTP_NOT_NETWORK_OR_FIRESTORE_LATENCY' });
    return JSON.parse(body);
  };
  const storefront = (await read('/api/storefront/catalog')).products;
  const cashier = await read('/api/caixa/products');
  const inventory = (await read('/api/inventory')).products;
  await read('/api/storefront/catalog?projection=list');
  await read('/api/caixa/products?projection=list');
  await read('/api/storefront/products/' + snapshot.products.find(product => commercialProduct(product).active).id);
  const byId = rows => new Map(rows.map(product => [product.id, product]));
  const maps = { storefront: byId(storefront), cashier: byId(cashier), inventory: byId(inventory) };
  const rows = snapshot.products.map(product => {
    const channels = { firestore: fields(product, 'firestore'), storefront: fields(maps.storefront.get(product.id)), cashier: fields(maps.cashier.get(product.id)),
      inventory: fields(maps.inventory.get(product.id)), whatsappBackend: fields(normalizeCatalogItem(product)) };
    const reasons = [];
    if (isInternalFinancialProduct(product)) reasons.push('INTERNAL_FINANCIAL_RECORD');
    if (!commercialProduct(product).active) reasons.push('INACTIVE_OR_UNAVAILABLE');
    const meta = projection(product, product.id, 'https://lojaconflora.web.app', snapshot.inventory);
    if (meta.availability === 'discontinued') reasons.push('META_NOT_ELIGIBLE');
    return { id: product.id, name: product.name, status: product.status, reasons, channels, metaProjection: meta };
  });
  const differences = rows.flatMap(row => Object.keys(row.channels.firestore).filter(field => !['stock', 'productInfo'].includes(field)).map(field => {
    const values = Object.fromEntries(Object.entries(row.channels).map(([channel, fields]) => [channel, fields?.[field] ?? null]));
    const published = ['storefront', 'cashier', 'whatsappBackend'].filter(channel => row.channels[channel]);
    const divergent = new Set(published.map(channel => fingerprint(values[channel]))).size > 1;
    return { id: row.id, name: row.name, field, sourcePresent: present(values.firestore), channelPresence: Object.fromEntries(Object.entries(values).map(([channel, value]) => [channel, present(value)])),
      divergent, fingerprints: Object.fromEntries(Object.entries(values).map(([channel, value]) => [channel, fingerprint(value)])) };
  }));
  const report = { at: new Date().toISOString(), sourceAt: snapshot.at, mode: 'READ_ONLY_SOURCE_AND_ISOLATED_HTTP', count: rows.length,
    counts: { active: snapshot.products.filter(product => commercialProduct(product).active).length, storefront: storefront.length,
      visible: storefront.filter(product => product.isAvailable && product.status !== 'INATIVO').length, cashier: cashier.length, inventory: inventory.length },
    routeMetrics, differences, rows };
  await fs.mkdir(path.dirname(prefix), { recursive: true });
  // Values may contain public media tokens: keep the detailed matrix private.
  await fs.writeFile('.private/audit/' + path.basename(prefix) + '.json', JSON.stringify(report, null, 2));
  const columns = ['id', 'name', 'field', 'sourcePresent', 'divergent', 'firestore', 'storefront', 'cashier', 'inventory', 'whatsappBackend'];
  const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  await fs.writeFile(prefix + '.csv', '\uFEFF' + [columns, ...differences.map(row => [...columns.slice(0, 5).map(key => row[key]), ...columns.slice(5).map(key => row.fingerprints[key])])].map(row => row.map(quote).join(',')).join('\r\n'));
  await fs.writeFile(prefix + '-summary.json', JSON.stringify({ ...report, rows: undefined, differences: undefined,
    divergentFieldCount: differences.filter(row => row.divergent).length, fingerprintNote: 'SHA256 of field values. Missing channel and empty field differ; intentional projections are explained in the audit report.' }, null, 2));
  console.log(JSON.stringify({ count: rows.length, ...report.counts, divergentFields: differences.filter(row => row.divergent).length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
