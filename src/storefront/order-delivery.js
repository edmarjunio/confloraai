const { createHmac } = require("node:crypto");
const { ensure } = require("./validation");

function validateWebhook(settings = {}) {
  if (!settings.orderWebhookUrl) {
    return { orderWebhookUrl: "", webhookSecretRef: "" };
  }
  let url;
  try {
    url = new URL(settings.orderWebhookUrl);
  } catch {
    throw new Error("URL de webhook inválida.");
  }
  const allowed = (process.env.STORE_WEBHOOK_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  ensure(
    url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      allowed.includes(url.hostname),
    "Domínio do webhook não autorizado pelo operador da plataforma.",
  );
  ensure(
    /^STORE_WEBHOOK_SECRET_[A-Z0-9_]+$/.test(settings.webhookSecretRef || ""),
    "Referência de segredo inválida.",
  );
  return {
    orderWebhookUrl: url.href,
    webhookSecretRef: settings.webhookSecretRef,
  };
}

/** At-least-once delivery. Receivers deduplicate using X-Event-Id. Redirects are never followed. */
async function deliverOrder(repo, tenantId, orderId, { request = fetch } = {}) {
  const privateConfig = await repo.get(tenantId, "privateConfig", "current");
  if (!privateConfig?.integrations?.orderWebhookUrl) {
    return { skipped: true };
  }
  const settings = validateWebhook(privateConfig.integrations);
  const secret = process.env[settings.webhookSecretRef];
  ensure(secret, "Segredo do webhook não configurado.", 503);
  const claim = await repo.atomic(tenantId, async (tx) => {
    const event = await tx.get("outbox", orderId);
    if (
      !event ||
      event.status === "SENT" ||
      (event.leaseUntil || 0) > Date.now() ||
      (event.nextAttemptAt || 0) > Date.now()
    ) {
      return null;
    }
    const order = await tx.get("orders", orderId);
    if (!order) {
      return null;
    }
    const next = {
      ...event,
      status: "SENDING",
      attempts: event.attempts + 1,
      leaseUntil: Date.now() + 30000,
    };
    tx.put("outbox", orderId, next);
    const publicOrder = { ...order };
    delete publicOrder.fingerprint;
    return { event: next, order: publicOrder };
  });
  if (!claim) {
    return { skipped: true };
  }
  const body = JSON.stringify({
    eventId: `${tenantId}:${orderId}`,
    type: "ORDER_CREATED",
    tenantId,
    order: claim.order,
  });
  try {
    const response = await request(settings.orderWebhookUrl, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
        "X-Event-Id": `${tenantId}:${orderId}`,
        "X-Store-Signature": createHmac("sha256", secret)
          .update(body)
          .digest("hex"),
      },
      body,
    });
    ensure(response.ok, "Webhook indisponível.", 502);
    await repo.put(tenantId, "outbox", orderId, {
      ...claim.event,
      status: "SENT",
      leaseUntil: 0,
      sentAt: new Date().toISOString(),
    });
    return { delivered: true };
  } catch {
    await repo.put(tenantId, "outbox", orderId, {
      ...claim.event,
      status: "PENDING",
      leaseUntil: 0,
      nextAttemptAt:
        Date.now() +
        Math.min(3600000, 30000 * 2 ** Math.min(claim.event.attempts, 7)),
    });
    return { delivered: false };
  }
}
module.exports = { deliverOrder, validateWebhook };
