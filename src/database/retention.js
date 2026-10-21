const DAY = 86400000;
function retentionDays(value, fallback = 30) {
  const days = Number(value);
  return Number.isSafeInteger(days) && days >= 1 && days <= 3650 ? days : fallback;
}
function compactOutboxRecord(record, { now = Date.now(), days = 30 } = {}) {
  // Retain the same document ID indefinitely. Deleting it would permit producers to resend.
  if (record?.status !== 'SENT' || record.compactedAt) return null;
  const completed = Date.parse(record.completedAt || record.sentAt || '');
  if (!Number.isFinite(completed) || completed > now - retentionDays(days) * DAY) return null;
  const keep = ['id', 'kind', 'orderId', 'settlementId', 'status', 'attempts', 'providerMessageId', 'providerDocumentId', 'sentAt', 'completedAt', 'textChunksSent', 'qrSent', 'documentSent', 'skipped'];
  return { ...Object.fromEntries(keep.filter(key => record[key] !== undefined).map(key => [key, record[key]])), compactedAt: new Date(now).toISOString() };
}
module.exports = { compactOutboxRecord, retentionDays };
