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

test('webhook signatures accept milliseconds and reject expired or malformed hashes', () => {
  const now = Date.now();
  const client = new MercadoPagoClient({ webhookSecret: 'secret' });
  const signed = (timestamp) => {
    const hash = createHmac('sha256', 'secret').update(`id:123;request-id:req;ts:${timestamp};`).digest('hex');
    return `ts=${timestamp},v1=${hash}`;
  };
  const input = { requestId: 'req', paymentId: '123', now };
  assert.equal(client.verifyWebhookSignature({ ...input, signature: signed(now) }), true);
  assert.equal(client.verifyWebhookSignature({ ...input, signature: signed(now - 360000) }), false);
  assert.equal(client.verifyWebhookSignature({ ...input, signature: signed(now) + 'zz' }), false);
  assert.equal(client.verifyWebhookSignature({ ...input, paymentId: '124', signature: signed(now) }), false);
});

test('signed notifications retry while the order is unavailable and reject invalid signatures', async (t) => {
  const client = new MercadoPagoClient({ webhookSecret: 'secret' });
  client.getPayment = async () => approvedPayment();
  const repo = new FirestoreRepository({ isInMemory: true });
  const server = createApp({ messageService: { firestoreRepo: repo }, mercadoPagoClient: client }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const timestamp = Date.now();
  const hash = createHmac('sha256', 'secret').update(`id:987654321;request-id:req;ts:${timestamp};`).digest('hex');
  const url = `http://127.0.0.1:${server.address().port}/webhooks/mercadopago?type=payment&data.id=987654321`;
  assert.equal((await fetch(url, { method: 'POST' })).status, 401);
  assert.equal((await fetch(url, { method: 'POST', headers: {
    'x-request-id': 'req', 'x-signature': `ts=${timestamp},v1=${hash}`,
  } })).status, 503);
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
  repository.inMemoryProducts.set('plant', { name: 'Muda de teste', stockQuantity: 10 });
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

test("storefront Sicredi PIX reserves stock and concurrent/repeated webhooks deduct once", async (t) => {
  const config = require("../src/config/env");
  const previousServiceUrl = config.tasks.serviceUrl;
  const previousSecret = process.env.SICREDI_WEBHOOK_SECRET;
  config.tasks.serviceUrl = "https://conflora.example";
  t.after(() => {
    config.tasks.serviceUrl = previousServiceUrl;
    if (previousSecret === undefined) delete process.env.SICREDI_WEBHOOK_SECRET;
    else process.env.SICREDI_WEBHOOK_SECRET = previousSecret;
  });
  process.env.SICREDI_WEBHOOK_SECRET = "sicredi-test-webhook-secret-with-32-chars";

  const repository = new FirestoreRepository({ isInMemory: true });
  repository.inMemoryProducts.set("plant", {
    id: "plant",
    name: "Muda de teste",
    price: order.total,
    stockQuantity: 10,
    status: "ATIVO",
  });
  const createDirectOrder = repository.createDirectOrder.bind(repository);
  // Em produção, requirePersistence é garantido pelo Firestore. Aqui o teste
  // usa o mesmo fluxo de rota com o armazenamento em memória.
  repository.createDirectOrder = (data, options = {}) =>
    createDirectOrder(data, { ...options, requirePersistence: false });
  let paymentOrderId = "";
  let chargeRequest;
  let qrSends = 0;
  const txid = "0123456789ABCDEF0123456789ABCDEF";
  const endToEndId = "E1234567890123456789012345678901";
  const app = createApp({
    messageService: {
      firestoreRepo: repository,
      whatsappClient: {
        sendTextMessage: async () => ({ messages: [{ id: "wamid-test" }] }),
        sendImageBuffer: async () => { qrSends += 1; return { messages: [{ id: "wamid-image-test" }] }; },
      },
    },
    sicrediClient: {
      pixKey: "pix-key-test",
      isOfficialApiConfigured: true,
      generateTxId: () => txid,
      createCharge: async (input) => {
        chargeRequest = input;
        paymentOrderId = input.ticketNumber;
        return {
          txid: input.txid,
          amount: input.amount,
          provider: "SICREDI",
          mode: "API_SICREDI_FIXED_AMOUNT",
          pixCopiaECola: "000201PIX-VALOR-FIXO-51.00",
          qrCodeBase64: "data:image/png;base64,aGVsbG8=",
        };
      },
      checkReceivedPayment: async (receivedEndToEndId) => ({
        isPaid: receivedEndToEndId === endToEndId,
        raw: {
          txid, endToEndId, chave: "pix-key-test", valor: "51.00", devolucoes: [],
        },
      }),
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const createResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      customerName: "Cliente teste",
      customerPhone: "64999999999",
      paymentMethod: "PIX",
      items: [{ productId: "plant", quantity: 2 }],
    }),
  });
  assert.equal(createResponse.status, 200);
  const created = await createResponse.json();
  paymentOrderId = created.order.id;
  assert.equal(chargeRequest.amount, 51);
  assert.equal(created.order.pixData.pixCopiaECola, "000201PIX-VALOR-FIXO-51.00");
  assert.match(created.order.pixData.qrCodeBase64, /^data:image\/png;base64,/);
  assert.equal(created.order.pixData.mode, "API_SICREDI_FIXED_AMOUNT");
  assert.equal(created.order.stockDeducted, undefined);
  assert.equal(repository.inMemoryProducts.get("plant").stockQuantity, 10);
  assert.equal(repository.inMemoryProducts.get("plant").reservedQuantity, 2);
  assert.equal(qrSends, 1);

  const webhookUrl = `${baseUrl}/webhooks/sicredi-pix/${process.env.SICREDI_WEBHOOK_SECRET}`;
  const sendWebhook = () =>
    fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pix: [{ txid, endToEndId }] }),
    });
  const concurrentResponses = await Promise.all([sendWebhook(), sendWebhook()]);
  for (const response of concurrentResponses) {assert.equal(response.status, 200);}
  assert.equal((await sendWebhook()).status, 200);

  const savedOrder = await repository.getOrderById(paymentOrderId);
  assert.equal(savedOrder.status, "CONFIRMED");
  assert.equal(savedOrder.paymentStatus, "APPROVED");
  assert.equal(repository.inMemoryProducts.get("plant").stockQuantity, 8);
  assert.equal(repository.inMemoryProducts.get("plant").reservedQuantity, 0);
  assert.equal(qrSends, 1);
});

test("payment webhook does not confirm an order when stock deduction fails", async (t) => {
  const repository = new FirestoreRepository({ isInMemory: true });
  await repository.createDirectOrder({
    ...order,
    status: "AWAITING_PIX",
    mercadoPagoPreferenceId: "preference-test",
  });
  repository.deductStock = async () => {
    throw new Error("stock persistence unavailable");
  };
  const payment = approvedPayment();
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
  assert.equal(response.status, 500);
  const savedOrder = await repository.getOrderById(order.id);
  assert.equal(savedOrder.status, "AWAITING_PIX");
  assert.equal(savedOrder.stockDeducted, undefined);
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
