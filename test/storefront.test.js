process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const { StoreRepository } = require("../src/storefront/repository");
const { StoreAssistant } = require("../src/storefront/assistant");
const {
  validateConfig,
  validateProduct,
} = require("../src/storefront/validation");
const { createApp } = require("../src/http/app");
const { FirestoreRepository } = require("../src/database/firestore.repository");
const { seedStores } = require("./storefront-fixture");
const { deliverOrder } = require("../src/storefront/order-delivery");

const checkout = (quantity = 1) => ({
  items: [{ productId: "product-1", quantity }],
  customer: { name: "Cliente", phone: "64999999999" },
  address: "",
  serviceArea: "",
  fulfillment: "pickup",
  paymentMethod: "PIX",
  cashTenderedMinor: 0,
});
async function repository() {
  const repo = new StoreRepository();
  await seedStores(repo);
  return repo;
}

test("checkout ignores client prices, is idempotent and reserves stock once", async () => {
  const repo = await repository();
  const input = { ...checkout(2), totalMinor: 1 };
  const [a, b] = await Promise.all([
    repo.createOrder("garden", input, null, "same-key"),
    repo.createOrder("garden", input, null, "same-key"),
  ]);
  assert.equal(a.id, b.id);
  assert.equal(a.totalMinor, 1200);
  assert.equal(
    (await repo.get("garden", "products", "product-1")).stock.quantity,
    8,
  );
  assert.equal(
    (await repo.get("pets", "products", "product-1")).stock.quantity,
    10,
  );
  await assert.rejects(
    repo.createOrder("garden", checkout(3), null, "same-key"),
    /outros dados/,
  );
});

test("concurrent orders cannot oversell and cancellation restores stock only once", async () => {
  const repo = await repository();
  const results = await Promise.allSettled([
    repo.createOrder("garden", checkout(7), null, "one"),
    repo.createOrder("garden", checkout(7), null, "two"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const order = results.find((r) => r.status === "fulfilled").value;
  await repo.updateOrder("garden", order.id, "CONFIRMED");
  assert.equal(
    (await repo.get("garden", "products", "product-1")).salesCount,
    7,
  );
  await repo.updateOrder("garden", order.id, "CANCELLED");
  await repo.updateOrder("garden", order.id, "CANCELLED");
  assert.equal(
    (await repo.get("garden", "products", "product-1")).stock.quantity,
    10,
  );
  assert.equal(
    (await repo.get("garden", "products", "product-1")).salesCount,
    0,
  );
  await assert.rejects(
    repo.updateOrder("garden", order.id, "CONFIRMED"),
    /Transição/,
  );
});

test("invalid fulfillment and disabled payment never write an order", async () => {
  const repo = await repository();
  await assert.rejects(
    repo.createOrder(
      "garden",
      { ...checkout(), paymentMethod: "WIRE" },
      null,
      "bad1",
    ),
    /Pagamento/,
  );
  await assert.rejects(
    repo.createOrder(
      "garden",
      {
        ...checkout(),
        fulfillment: "delivery",
        address: "Rua do teste, 10",
        serviceArea: "Fora",
      },
      null,
      "bad2",
    ),
    /região/,
  );
  assert.equal((await repo.list("garden", "orders")).length, 0);
});

test("product and theme validation reject unsafe URLs and unknown categories", async () => {
  const repo = await repository();
  const config = await repo.config("garden");
  assert.throws(
    () =>
      validateConfig(
        {
          ...config,
          branding: { ...config.branding, logoUrl: "javascript:alert(1)" },
        },
        "garden",
      ),
    /HTTPS/,
  );
  const product = await repo.get("garden", "products", "product-1");
  assert.throws(
    () =>
      validateProduct(
        { ...product, categories: ["other-store"] },
        "garden",
        config,
      ),
    /Categoria/,
  );
});

test("assistant validates model product IDs against the current tenant catalogue", async () => {
  const repo = await repository();
  const calls = [];
  const ai = new StoreAssistant({
    client: {
      models: {
        generateContent: async (request) => {
          calls.push(request);
          return calls.length === 1
            ? {
                text: "Pesquisa",
                candidates: [
                  {
                    groundingMetadata: {
                      groundingChunks: [
                        {
                          web: {
                            uri: "https://example.org/info",
                            title: "Fonte técnica",
                          },
                        },
                      ],
                    },
                  },
                ],
              }
            : {
                text: JSON.stringify({
                  message: "É isso que procura?",
                  productIds: ["other-tenant-id", "product-1"],
                }),
              };
        },
      },
    },
  });
  const result = await ai.recommend(
    await repo.config("pets"),
    { persona: "Consultor pet", webSearchEnabled: true },
    await repo.list("pets", "products"),
    { message: "ração para gatos" },
  );
  assert.deepEqual(
    result.products.map((p) => p.name),
    ["Ração para gatos"],
  );
  assert.equal(result.mode, "GROUNDED_AI");
  assert.ok(calls[0].config.tools[0].googleSearch);
  assert.ok(!JSON.stringify(calls).includes("Manjericão"));
});

test("HTTP tenant sessions, admin access, customer orders and public config are isolated", async (t) => {
  const repo = await repository();
  const app = createApp({
    messageService: {
      firestoreRepo: new FirestoreRepository({ isInMemory: true }),
    },
    storeRepository: repo,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/stores`;
  const request = (
    slug,
    path,
    body,
    cookie = "",
    method = body ? "POST" : "GET",
    headers = {},
  ) =>
    fetch(`${base}/${slug}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const login = await request("garden", "/auth/login", {
    email: "admin@test.com",
    password: "test-password-123",
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await request("garden", "/admin/products", null, cookie)).status,
    200,
  );
  assert.equal(
    (await request("pets", "/admin/products", null, cookie)).status,
    403,
  );
  const config = await (await request("pets", "/config")).text();
  assert.ok(!config.includes("never-public"));
  assert.ok(!config.includes("persona"));
  assert.equal((await request("missing", "/config")).status, 404);
  const register = await request("garden", "/auth/register", {
    name: "Cliente",
    email: "customer@test.com",
    password: "password-123",
    role: "ADMIN",
  });
  const userCookie = register.headers.get("set-cookie").split(";")[0];
  assert.equal((await register.json()).user.role, "CUSTOMER");
  assert.equal(
    (await request("garden", "/admin/products", null, userCookie)).status,
    403,
  );
  const response = await request(
    "garden",
    "/orders",
    checkout(),
    userCookie,
    "POST",
    { "Idempotency-Key": "http-order" },
  );
  assert.equal(response.status, 201);
  assert.equal(
    (await (await request("garden", "/orders", null, userCookie)).json())
      .length,
    1,
  );
  assert.equal(
    (await request("pets", "/orders", null, userCookie)).status,
    401,
  );
  assert.equal(
    (
      await request("garden", "/orders", checkout(), userCookie, "POST", {
        Origin: "https://evil.example",
        "Idempotency-Key": "csrf-order",
      })
    ).status,
    403,
  );
  const staleProduct = await repo.get("garden", "products", "product-1");
  await repo.createOrder("garden", checkout(), null, "stock-change");
  assert.equal(
    (
      await request(
        "garden",
        "/admin/products/product-1",
        staleProduct,
        cookie,
        "PUT",
      )
    ).status,
    409,
  );
  assert.equal(
    (await repo.get("garden", "products", "product-1")).stock.quantity,
    8,
  );
});

test("webhook is signed, deduplicated and denied outside operator allowlist", async () => {
  const repo = await repository();
  const oldHosts = process.env.STORE_WEBHOOK_ALLOWED_HOSTS;
  process.env.STORE_WEBHOOK_ALLOWED_HOSTS = "orders.example.com";
  process.env.STORE_WEBHOOK_SECRET_TEST = "test-secret";
  try {
    await repo.put("garden", "privateConfig", "current", {
      integrations: {
        orderWebhookUrl: "https://orders.example.com/events",
        webhookSecretRef: "STORE_WEBHOOK_SECRET_TEST",
      },
    });
    const order = await repo.createOrder(
      "garden",
      checkout(),
      null,
      "webhook-test",
    );
    let calls = 0;
    const request = async (_url, options) => {
      calls++;
      assert.equal(options.redirect, "error");
      assert.ok(options.headers["X-Store-Signature"]);
      assert.ok(!options.body.includes("fingerprint"));
      return { ok: true };
    };
    await deliverOrder(repo, "garden", order.id, { request });
    await deliverOrder(repo, "garden", order.id, { request });
    assert.equal(calls, 1);
    await repo.put("garden", "privateConfig", "current", {
      integrations: {
        orderWebhookUrl: "https://private.example.com/events",
        webhookSecretRef: "STORE_WEBHOOK_SECRET_TEST",
      },
    });
    await assert.rejects(
      deliverOrder(repo, "garden", order.id, { request }),
      /não autorizado/,
    );
  } finally {
    if (oldHosts === undefined) {
      delete process.env.STORE_WEBHOOK_ALLOWED_HOSTS;
    } else {
      process.env.STORE_WEBHOOK_ALLOWED_HOSTS = oldHosts;
    }
    delete process.env.STORE_WEBHOOK_SECRET_TEST;
  }
});
