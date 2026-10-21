// Read-only by default. Mutation is deliberately restricted to a loopback emulator.
const { Firestore } = require('@google-cloud/firestore');
const { compactOutboxRecord, retentionDays } = require('../src/database/retention');

async function main() {
  const apply = process.argv.includes('--apply');
  const host = process.env.FIRESTORE_EMULATOR_HOST || '';
  if (apply && !/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host)) throw new Error('--apply exige emulador local; produção permite somente inspeção.');
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new Error('Defina GOOGLE_CLOUD_PROJECT explicitamente.');
  const db = new Firestore({ projectId });
  const report = { apply, scanned: 0, compactable: 0, pendingWithExpiry: 0, updated: 0, pages: 0, truncated: false };
  const days = retentionDays(process.env.PDV_OUTBOX_RETENTION_DAYS);
  const maxPages = 100; // Explicit bounded run. Rerun after reviewing results.
  try {
    for (const collection of ['pdv_outbox', 'incoming_messages']) {
      let cursor;
      for (let index = 0; index < maxPages; index++) {
        let query = db.collection(collection).orderBy('__name__').limit(100);
        if (cursor) query = query.startAfter(cursor);
        const page = await query.get();
        report.pages++;
        for (const doc of page.docs) {
          report.scanned++;
          const record = doc.data();
          const compact = collection === 'pdv_outbox' ? compactOutboxRecord(record, { days }) : null;
          const unsafeExpiry = collection === 'incoming_messages' && record.status !== 'COMPLETED' && record.expiresAt !== null && record.expiresAt !== undefined;
          if (compact) report.compactable++;
          if (unsafeExpiry) report.pendingWithExpiry++;
          if (apply && (compact || unsafeExpiry)) {
            // Re-read and validate eligibility inside the transaction; never overwrite a changed job.
            await db.runTransaction(async tx => {
              const current = (await tx.get(doc.ref)).data();
              const next = collection === 'pdv_outbox' ? compactOutboxRecord(current, { days }) : null;
              if (next) tx.set(doc.ref, next);
              else if (collection === 'incoming_messages' && current?.status !== 'COMPLETED' && current?.expiresAt !== null && current?.expiresAt !== undefined) tx.update(doc.ref, { expiresAt: null });
            });
            report.updated++;
          }
        }
        if (page.size < 100) break;
        cursor = page.docs[page.docs.length - 1];
        if (index === maxPages - 1) report.truncated = true;
      }
    }
    console.log(JSON.stringify(report, null, 2));
  } finally { await db.terminate(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
