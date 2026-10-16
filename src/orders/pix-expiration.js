const PIX_PAYMENT_TTL_SECONDS = Math.min(
  86400,
  Math.max(300, Number(process.env.PIX_PAYMENT_TTL_SECONDS) || 3600),
);

function pixExpirationDate(createdAt = Date.now(), ttlSeconds = PIX_PAYMENT_TTL_SECONDS) {
  const timestamp = new Date(createdAt).getTime();
  return new Date((Number.isFinite(timestamp) ? timestamp : Date.now()) + ttlSeconds * 1000).toISOString();
}

function isPixOrderExpired(order, now = Date.now()) {
  const expiresAt = order.pixExpiresAt || pixExpirationDate(order.createdAt);
  const timestamp = new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= now;
}

module.exports = { PIX_PAYMENT_TTL_SECONDS, pixExpirationDate, isPixOrderExpired };
