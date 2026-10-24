const { createHash } = require('node:crypto');
const { runTransaction } = require('../transactions');
const RANK = { ACCEPTED: 0, SENT: 1, FAILED: 2, DELIVERED: 3, READ: 4 };

async function recordWhatsAppStatus(repo, callback) {
  const providerStatus = String(callback.status || '').toUpperCase();
  if (!callback.id || !['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(providerStatus)) return false;
  const id = createHash('sha256').update(`${callback.id}:${providerStatus}`).digest('hex');
  let jobs;
  if (repo.firestore && !repo._firestoreClientDisabled) {
    const snapshots = await Promise.all(['providerMessageId', 'providerDocumentId'].map(field =>
      repo.firestore.collection('pdv_outbox').where(field, '==', callback.id).limit(100).get()));
    jobs = [...new Set(snapshots.flatMap(snap => snap.docs.map(doc => doc.id)))];
  } else if (repo.isInMemory && !repo.firestore) {
    jobs = [...(repo.pdvMemory?.get('pdv_outbox')?.values() || [])]
      .filter(job => job.providerMessageId === callback.id || job.providerDocumentId === callback.id).map(job => job.id);
  } else throw new Error('Firestore indisponível para registrar entrega WhatsApp.');
  return runTransaction(repo, async tx => {
    const event = await tx.get('whatsapp_delivery_events', id);
    if (event?.status === 'DONE') return false;
    const matches = (await Promise.all(jobs.map(jobId => tx.get('pdv_outbox', jobId)))).filter(Boolean);
    const now = new Date().toISOString();
    for (const job of matches) {
      if ((RANK[job.deliveryStatus] ?? 0) >= RANK[providerStatus]) continue;
      tx.set('pdv_outbox', job.id, { ...job, deliveryStatus: providerStatus, deliveryUpdatedAt: now });
    }
    if (!event || matches.length) tx.set('whatsapp_delivery_events', id, {
      id, providerMessageId: callback.id, providerStatus, timestamp: String(callback.timestamp || ''),
      status: matches.length ? 'DONE' : 'PENDING', createdAt: event?.createdAt || now,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });
    return Boolean(matches.length);
  });
}

module.exports = { recordWhatsAppStatus };
