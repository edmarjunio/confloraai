// Operator-only plan. It never initializes Firebase, writes products or approves content.
const fs = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { detailFields } = require('../src/catalog/registered-product-content');
const fields = [...new Set(['description', ...detailFields, 'specifications', 'especificacoes', 'contentSections'])];
const hash = value => createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
const populated = value => value !== undefined && value !== null && value !== '' &&
  (typeof value !== 'object' || Object.keys(value).length > 0);
function planMetadataMigration(products, historical) {
  const byId = new Map(historical.map(product => [product.id, product]));
  const changes = products.flatMap(product => {
    const old = byId.get(product.id);
    if (!old) return [];
    return fields.filter(field => populated(old[field]) && hash(old[field]) !== hash(product[field])).map(field => ({
      id: product.id, name: product.name, field,
      action: populated(product[field]) ? 'PRESERVE_FIRESTORE' : 'REQUIRES_STAFF_REVIEW',
      currentHash: hash(product[field]), proposedHash: hash(old[field]), expectedUpdatedAt: product.updatedAt || null,
      // Values remain in the operator's private plan, never imported by runtime.
      proposedValue: old[field],
    }));
  });
  return { version: 1, mode: 'DRY_RUN_ONLY', sourceCount: products.length, historicalCount: historical.length,
    authority: 'Firestore; historical JSON is an unreviewed migration candidate, not a fallback.', changes };
}
async function main() {
  const [source, historical = 'config/stores/conflora-validated-catalog.json', output = '.private/audit/metadata-migration-plan.json'] = process.argv.slice(2);
  if (!source || process.argv.includes('--apply')) throw new Error('Use um snapshot privado. Este comando só gera plano; não aceita --apply.');
  const snapshot = JSON.parse(await fs.readFile(source, 'utf8'));
  const plan = planMetadataMigration(snapshot.products || snapshot, JSON.parse(await fs.readFile(historical, 'utf8')));
  await fs.writeFile(output, JSON.stringify(plan, null, 2));
  console.log(JSON.stringify({ mode: plan.mode, sourceCount: plan.sourceCount, historicalCount: plan.historicalCount,
    preserveFirestore: plan.changes.filter(row => row.action === 'PRESERVE_FIRESTORE').length,
    reviewRequired: plan.changes.filter(row => row.action === 'REQUIRES_STAFF_REVIEW').length }));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { planMetadataMigration };
