process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { once } = require("node:events");
const { MercadoPagoClient, isApprovedPixPayment } = require("../src/integrations/mercado-pago.client");
const { formatOrderReceipt } = require("../src/orders/receipt.util");
const { FirestoreRepository } = require("../src/database/firestore.repository");
const { createApp } = require("../src/http/app");

const order = {
  id: "order-mp-test",
  ticketNumber: "123",
  customerName: "Cliente Teste",
  customerPhone: "64999999999",
  paymentMethod: "PIX",
  total: 25.5,
  paymentCheckoutUrl: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=test",
  items: [{ name: "Muda de teste", price: 25.5, quantity: 1 }],
};

function approvedPayment(overrides = {}) {
  return {
    id: 987654321,
    status: "approved",
    payment_method_id: "pix",
    currency_id: "BRL",
    external_reference: order.id,
    transaction_amount: order.total,
    date_created: "2026-01-01T10:00:00.000Z",
    date_approved: "2026-01-01T10:01:00.000Z",
    ...overrides,
  };
}

test("Mercado Pago accepts a correct signed webhook and rejects altered signatures", () => {
  const secret = "test-secret";
  const requestId = "request-123";
  const paymentId = "987654321";
  const timestamp = Math.floor(Date.now() / 1000);
  const manifest = `id:${paymentId};request-id:${requestId};ts:${timestamp};`;
  const signature = createHmac("sha256", secret).update(manifest).digest("hex");
  const client = new MercadoPagoClient({ webhookSecret: secret });

  assert.equal(
    client.verifyWebhookSignature({
      signature: `ts=${timestamp},v1=${signature}`,
      requestId,
      paymentId,
    }),
    true,
  );
  assert.equal(
    client.verifyWebhookSignature({
      signature: `ts=${timestamp},v1=${"0".repeat(64)}`,
      requestId,
      paymentId,
    }),
    false,
  );
});

test("PIX Checkout Pro creates a secure preference tied to the order", async () => {
  let requestBody;
  const client = new MercadoPagoClient({
    accessToken: "test-access-token",
    webhookSecret: "test-webhook-secret",
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          id: "preference-123",
          init_point: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=preference-123",
        }),
      };
    },
  });
  const result = await client.createPixCheckout({
    order,
    payerEmail: "cliente@example.com",
    notificationUrl: "https://conflora.example/webhooks/mercadopago",
  });

  assert.equal(client.checkoutConfigured, true);
  assert.equal(result.id, "preference-123");
  assert.equal(requestBody.external_reference, order.id);
  assert.equal(requestBody.items[0].unit_price, order.total);
  assert.equal(requestBody.payer.email, "cliente@example.com");
  assert.equal(
    requestBody.notification_url,
    "https://conflora.example/webhooks/mercadopago",
  );
  assert.equal(
    requestBody.payment_methods.excluded_payment_types.some(({ id }) => id === "ticket"),
    true,
  );
});

test("PIX confirmation requires an approved matching BRL payment", () => {
  assert.equal(isApprovedPixPayment(approvedPayment(), order), true);
  assert.equal(isApprovedPixPayment(approvedPayment({ status: "pending" }), order), false);
  assert.equal(
    isApprovedPixPayment(approvedPayment({ transaction_amount: 25.49 }), order),
    false,
  );
  assert.equal(
    isApprovedPixPayment(approvedPayment({ external_reference: "another-order" }), order),
    false,
  );
  assert.equal(
    isApprovedPixPayment(approvedPayment({ date_approved: "2026-01-01T09:59:00.000Z" }), order),
    false,
  );
});

test("screen and WhatsApp can use the same canonical order receipt", () => {
  const receipt = formatOrderReceipt(order);

  assert.match(receipt, /Pedido #123/);
  assert.match(receipt, /Muda de teste/);
  assert.match(receipt, /R\$\s*25,50/);
  assert.match(receipt, /mercadopago\.com\.br/);
  assert.equal(formatOrderReceipt(order), receipt);
});

test("PIX orders cannot fall back to volatile in-memory persistence", async () => {
  const repository = new FirestoreRepository({ isInMemory: true });

  await assert.rejects(
    repository.createDirectOrder(
      { ...order, status: "AWAITING_PIX" },
      { requirePersistence: true },
    ),
    /persistência disponível/,
  );
});

test("payment webhook confirms only the matching approved PIX order", async (t) => {
  const repository = new FirestoreRepository({ isInMemory: true });
  await repository.createDirectOrder({
    ...order,
    status: "AWAITING_PIX",
    mercadoPagoPreferenceId: "preference-test",
  });
  const payment = approvedPayment();
  const app = createApp({
    messageService: {
      firestoreRepo: repository,
      whatsappClient: { sendTemplate: async () => ({ success: true }) },
    },
    mercadoPagoClient: {
      configured: true,
      verifyWebhookSignature: () => true,
      getPayment: async () => payment,
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/webhooks/mercadopago?type=payment&data.id=${payment.id}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "x-signature": "test", "x-request-id": "request-123" },
  });
  assert.equal(response.status, 200);
  const savedOrder = await repository.getOrderById(order.id);
  assert.equal(savedOrder.status, "CONFIRMED");
  assert.equal(savedOrder.paymentStatus, "APPROVED");
  assert.equal(savedOrder.paymentTransactionId, String(payment.id));
});

test("payment webhook does not confirm amount mismatches", async (t) => {
  const repository = new FirestoreRepository({ isInMemory: true });
  await repository.createDirectOrder({
    ...order,
    status: "AWAITING_PIX",
    mercadoPagoPreferenceId: "preference-test",
  });
  const payment = approvedPayment({ transaction_amount: order.total + 1 });
  const app = createApp({
    messageService: { firestoreRepo: repository },
    mercadoPagoClient: {
      configured: true,
      verifyWebhookSignature: () => true,
      getPayment: async () => payment,
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/webhooks/mercadopago?type=payment&data.id=${payment.id}`,
    {
      method: "POST",
      headers: { "x-signature": "test", "x-request-id": "request-123" },
    },
  );

  assert.equal(response.status, 200);
  assert.equal((await repository.getOrderById(order.id)).status, "AWAITING_PIX");
});
