// Read-only unless --apply is explicitly supplied. Never prints credentials or emails.
const { createHash } = require('node:crypto');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { protectCredentials } = require('../src/security/credentials');

async function main() {
  if (process.env.NODE_ENV === 'test') throw new Error('Use um projeto de homologação, sem NODE_ENV=test.');
  const repository = new FirestoreRepository();
  const db = repository.firestore;
  if (!db) throw new Error('Firestore indisponível.');
  const apply = process.argv.includes('--apply');
  let cursor; let count = 0; let pending = 0;
  const owners = new Map();
  // Preflight the complete collection before any write, without logging personal data.
  while (true) {
    let query = db.collection('users').orderBy('__name__').limit(200);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const document of page.docs) {
      const user = document.data();
      const email = String(user.email || '').toLowerCase().trim();
      if (email && owners.has(email)) throw new Error('E-mails duplicados encontrados. Resolva os cadastros antes da migração.');
      if (email) owners.set(email, document.id);
      count++; if (user.pin || user.password) pending++;
    }
    if (page.size < 200) break;
    cursor = page.docs.at(-1);
  }
  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', users: count, plaintextToMigrate: pending, emailIndexes: owners.size }));
  if (!apply) return;
  cursor = undefined;
  while (true) {
    let query = db.collection('users').orderBy('__name__').limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const document of page.docs) {
      await db.runTransaction(async tx => {
        const current = await tx.get(document.ref);
        if (!current.exists) return;
        const user = current.data();
        const email = String(user.email || '').toLowerCase().trim();
        const identity = email ? db.collection('user_emails').doc(createHash('sha256').update(email).digest('hex')) : null;
        const existing = identity ? await tx.get(identity) : null;
        if (existing?.exists && existing.data().userId !== document.id) throw new Error('Índice de e-mail divergente; migração interrompida.');
        const protectedUser = await protectCredentials({ ...user, email });
        tx.set(document.ref, protectedUser);
        if (identity) tx.set(identity, { userId: document.id });
      });
    }
    if (page.size < 100) break;
    cursor = page.docs.at(-1);
  }
  console.log('Migração concluída. Nenhum dado financeiro foi alterado.');
}
main().catch(() => { console.error('Migração interrompida. Verifique credenciais, duplicidades e disponibilidade do banco.'); process.exitCode = 1; });
