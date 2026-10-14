const { createHmac, timingSafeEqual } = require("node:crypto");

const API_URL = "https://api.mercadopago.com";

class MercadoPagoClient {
  constructor({
    accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "",
    webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || "",
    fetchImpl = globalThis.fetch,
  } = {}) {
    this.accessToken = accessToken;
    this.webhookSecret = webhookSecret;
    this.fetchImpl = fetchImpl;
  }

  get configured() {
    return Boolean(this.accessToken);
  }

  get checkoutConfigured() {
    return Boolean(this.accessToken && this.webhookSecret);
  }

  verifyWebhookSignature({ signature, requestId, paymentId, now = Date.now() }) {
    if (!this.webhookSecret || !signature || !requestId || !paymentId) {
      return false;
    }
    const fields = Object.fromEntries(
      signature.split(",").map((field) => {
        const separator = field.indexOf("=");
        return separator < 0
          ? [field.trim(), ""]
          : [
              field.slice(0, separator).trim(),
              field.slice(separator + 1).trim(),
            ];
      }),
    );
    const timestamp = Number(fields.ts);
    // O provedor documenta milissegundos; aceita também eventos em segundos.
    const timestampMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
    if (
      !/^[a-fA-F0-9]{64}$/.test(fields.v1 || "") ||
      !Number.isSafeInteger(timestamp) ||
      Math.abs(now - timestampMs) > 5 * 60 * 1000
    ) {
      return false;
    }
    const manifest = `id:${String(paymentId).toLowerCase()};request-id:${requestId};ts:${fields.ts};`;
    const expected = createHmac("sha256", this.webhookSecret)
      .update(manifest)
      .digest();
    let received;
    try {
      received = Buffer.from(fields.v1, "hex");
    } catch {
      return false;
    }
    return received.length === expected.length && timingSafeEqual(received, expected);
  }

  async createPixCheckout({ order, payerEmail = "", notificationUrl }) {
    this.ensureConfigured();
    const amount = Number(order.total);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("O valor do pedido não permite gerar o pagamento PIX.");
    }
    if (!notificationUrl) {
      throw new Error("Configure SERVICE_URL para receber confirmações do Mercado Pago.");
    }
    const ticket = String(order.ticketNumber || order.id).slice(-20);
    const preference = await this.request("/checkout/preferences", {
      method: "POST",
      body: {
        items: [
          {
            id: String(order.id),
            title: `Pedido Conflora #${ticket}`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(amount.toFixed(2)),
          },
        ],
        ...(payerEmail ? { payer: { email: payerEmail } } : {}),
        external_reference: String(order.id),
        notification_url: notificationUrl,
        payment_methods: {
          excluded_payment_types: [
            { id: "credit_card" },
            { id: "debit_card" },
            { id: "ticket" },
          ],
        },
        metadata: { order_id: String(order.id) },
      },
    });
    if (
      typeof preference.id !== "string" ||
      typeof preference.init_point !== "string" ||
      !preference.init_point.startsWith("https://")
    ) {
      throw new Error("O Mercado Pago não retornou um link de pagamento válido.");
    }
    return {
      id: preference.id,
      checkoutUrl: preference.init_point,
    };
  }

  async getPayment(paymentId) {
    if (!/^\d+$/.test(String(paymentId))) {
      throw new Error("Identificador de pagamento do Mercado Pago inválido.");
    }
    return this.request(`/v1/payments/${encodeURIComponent(paymentId)}`);
  }

  async findPaymentsByOrderId(orderId) {
    const result = await this.request(
      `/v1/payments/search?external_reference=${encodeURIComponent(String(orderId))}&sort=date_created&criteria=desc`,
    );
    return Array.isArray(result.results) ? result.results : [];
  }

  async request(path, { method = "GET", body } = {}) {
    this.ensureConfigured();
    if (typeof this.fetchImpl !== "function") {
      throw new Error("O serviço de pagamentos não está disponível neste servidor.");
    }
    const response = await this.fetchImpl(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("O Mercado Pago retornou uma resposta inválida.");
    }
    if (!response.ok) {
      const detail = data?.message || data?.error;
      throw new Error(
        detail
          ? `Mercado Pago: ${detail}`
          : `Mercado Pago indisponível (HTTP ${response.status}).`,
      );
    }
    return data;
  }

  ensureConfigured() {
    if (!this.accessToken) {
      throw new Error("Configure MERCADO_PAGO_ACCESS_TOKEN para aceitar pagamentos PIX.");
    }
  }
}

function isApprovedPixPayment(payment, order) {
  const expectedAmount = Number(order.total);
  const amount = Number(payment?.transaction_amount);
  const createdAt = Date.parse(payment?.date_created || "");
  const approvedAt = Date.parse(payment?.date_approved || "");
  return (
    payment?.status === "approved" &&
    payment?.payment_method_id === "pix" &&
    payment?.currency_id === "BRL" &&
    String(payment?.external_reference || "") === String(order.id) &&
    Number.isFinite(expectedAmount) &&
    expectedAmount > 0 &&
    Number.isFinite(amount) &&
    Math.round(amount * 100) === Math.round(expectedAmount * 100) &&
    Number.isFinite(createdAt) &&
    Number.isFinite(approvedAt) &&
    approvedAt >= createdAt
  );
}

module.exports = { MercadoPagoClient, isApprovedPixPayment };
