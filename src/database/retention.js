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
  const keep = ['id', 'kind', 'orderId', 'settlementId', 'status', 'attempts', 'providerMessageId', 'providerDocumentId', 'sentAt', 'completedAt', 'textChunksSent', 'qrSent', 'documentSent', 'skipped', 'deliveryStatus'];
  return { ...Object.fromEntries(keep.filter(key => record[key] !== undefined).map(key => [key, record[key]])), compactedAt: new Date(now).toISOString() };
}
function compactIncomingRecord(record, { now = Date.now(), days = 30 } = {}) {
  if (record?.status !== 'COMPLETED' || record.compactedAt) return null;
  const completed = Date.parse(record.completedAt || '');
  // Legacy records without a completion date require inspection, never inference from creation time.
  if (!Number.isFinite(completed) || completed > now - retentionDays(days) * DAY) return null;
  return { id: record.id, status: 'COMPLETED', completedAt: record.completedAt,
    attempts: Number(record.attempts || 0), compactedAt: new Date(now).toISOString(), expiresAt: null };
}

function conversationExpiry(env = process.env, now = Date.now()) {
  const days = Number(env.WHATSAPP_HISTORY_RETENTION_DAYS);
  // Off by default. This field is separate from login sessions and ordinary message fields.
  return Number.isSafeInteger(days) && days >= 90 && days <= 3650 ? new Date(now + days * DAY) : null;
}

module.exports = { compactOutboxRecord, compactIncomingRecord, conversationExpiry, retentionDays };
