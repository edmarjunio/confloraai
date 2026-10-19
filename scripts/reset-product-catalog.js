// Explicit migration utility. Does not delete sales, customers, balances or image files.
const fs = require('node:fs/promises');
const path = require('node:path');
const { FirestoreRepository } = require('../src/database/firestore.repository');
async function main() {
  const repository = new FirestoreRepository(); const db = repository.firestore;
  if (!db || db.projectId !== 'confloraai' || process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Destino inesperado; operação bloqueada.');
  const apply = process.argv.includes('--apply');
  const snapshot = await db.collection('products').get();
  const counts = { products: snapshot.size, reserved: snapshot.docs.filter(doc => Number(doc.data().reservedQuantity || 0) > 0).length };
  console.log(JSON.stringify({ project: db.projectId, mode: apply ? 'APPLY' : 'DRY_RUN', ...counts }));
  if (!apply) { await db.terminate(); return; }
  if (counts.reserved) throw new Error('Há produtos com reservas ativas. Conclua ou cancele os pedidos antes de limpar o catálogo.');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = path.resolve(__dirname, '../.private/backups'); await fs.mkdir(directory, { recursive: true });
  const backup = path.join(directory, `catalog-before-reset-${timestamp}.json`);
  await fs.writeFile(backup, JSON.stringify({ projectId: db.projectId, collection: 'products', exportedAt: new Date().toISOString(), count: snapshot.size, documents: snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })) }, null, 2), { flag: 'wx', mode: 0o600 });
  const verified = JSON.parse(await fs.readFile(backup, 'utf8'));
  if (verified.documents.length !== snapshot.size) throw new Error('Backup incompleto; exclusão não iniciada.');
  // Copy the backup into a separate collection before deletion. Firestore data types are preserved.
  const archive = db.collection('catalog_archives').doc(timestamp);
  await archive.set({ createdAt: new Date().toISOString(), count: snapshot.size, reason: 'Migração de catálogo autorizada pelo dono', status: 'BACKING_UP' });
  for (let offset = 0; offset < snapshot.size; offset += 200) {
    const batch = db.batch();
    for (const document of snapshot.docs.slice(offset, offset + 200)) batch.set(archive.collection('products').doc(document.id), document.data());
    await batch.commit();
  }
  if ((await archive.collection('products').count().get()).data().count !== snapshot.size) throw new Error('Arquivo do banco incompleto; exclusão não iniciada.');
  await archive.update({ status: 'BACKED_UP' });
  let deleted = 0;
  for (let offset = 0; offset < snapshot.size; offset += 200) {
    const batch = db.batch();
    for (const document of snapshot.docs.slice(offset, offset + 200)) batch.delete(document.ref, { lastUpdateTime: document.updateTime });
    await batch.commit(); deleted += Math.min(200, snapshot.size - offset);
    await archive.update({ deleted });
  }
  const remaining = (await db.collection('products').count().get()).data().count;
  await archive.update({ status: remaining ? 'CHECK_REQUIRED' : 'COMPLETED', completedAt: new Date().toISOString(), remaining });
  console.log(JSON.stringify({ deleted, remaining, backup, archive: archive.path, salesAndCustomersPreserved: true }));
  await db.terminate();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
