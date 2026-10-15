const test = require("node:test");
const assert = require("node:assert/strict");

const storage = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
});
test.beforeEach(() => storage.clear());

test("Zustand hydrates legacy carts, shares actions and enforces available stock", async () => {
  const { createCartStore } = await import("../src/web/state/cart-store.mjs");
  storage.set(
    "cart",
    JSON.stringify([
      { productId: "p", quantity: 1 },
      { productId: "invalid", quantity: -1 },
    ]),
  );
  const cart = createCartStore("cart");
  const product = { id: "p", stock: { tracked: true, quantity: 3 } };
  cart.getState().add(product);
  cart.getState().add(product);
  cart.getState().add(product);
  assert.deepEqual(cart.getState().items, [{ productId: "p", quantity: 3 }]);
  assert.equal(JSON.parse(storage.get("cart"))[0].quantity, 3);
  assert.deepEqual(createCartStore("other-operator").getState().items, []);
});

test("sale migration strips persisted bank approval and keeps the same attempt on retry", async () => {
  const { createSaleStore } = await import("../src/web/state/sale-store.mjs");
  storage.set(
    "pdv-attempt:alice",
    JSON.stringify({
      requestId: "original-attempt",
      order: {
        id: "order-a",
        paymentStatus: "PAGO",
        paymentTransactionId: "forged",
      },
    }),
  );
  const sale = createSaleStore("alice");
  assert.equal(sale.getState().draft.orderId, "order-a");
  assert.equal(sale.getState().draft.order, undefined);
  assert.equal(storage.get("pdv-attempt:alice").includes("PAGO"), false);
  sale.getState().reset();
  const first = sale.getState().begin({ items: [] });
  const second = sale.getState().begin({ items: [] });
  assert.equal(first, second);
  assert.equal(JSON.parse(storage.get("pdv-attempt:alice")).requestId, first);
  sale.getState().reset();
  assert.notEqual(sale.getState().begin({ items: [] }), first);
  assert.equal(createSaleStore("bob").getState().draft.orderId, "");
});

test("Query deduplicates concurrent reads and separates users", async () => {
  const { createQueryClient } =
    await import("../src/web/state/query-client.mjs");
  const client = createQueryClient();
  let calls = 0;
  let finish;
  const options = {
    queryKey: ["resource", "main", "alice", "orders"],
    queryFn: () => {
      calls++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  };
  const first = client.fetchQuery(options);
  const second = client.fetchQuery(options);
  assert.equal(calls, 1);
  finish(["alice-order"]);
  assert.deepEqual(await first, await second);
  assert.equal(
    client.getQueryData(["resource", "main", "bob", "orders"]),
    undefined,
  );
  client.clear();
});

test("logout cancels in-flight requests and removes private cached data", async () => {
  const { createQueryClient, clearPrivateQueries } =
    await import("../src/web/state/query-client.mjs");
  const client = createQueryClient();
  let aborted = false;
  client.setQueryData(["session", "main"], { user: null });
  client.setQueryData(["payment", "main", "alice", "order"], {
    paymentStatus: "PAGO",
  });
  const pending = client
    .fetchQuery({
      queryKey: ["resource", "main", "alice", "orders"],
      queryFn: ({ signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted"));
          });
        }),
    })
    .catch(() => null);
  await clearPrivateQueries(client);
  await pending;
  assert.equal(aborted, true);
  assert.deepEqual(
    client
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey[0]),
    ["session"],
  );
  client.clear();
});

test("mutations do not retry a failed financial write", async () => {
  const { createQueryClient } =
    await import("../src/web/state/query-client.mjs");
  const client = createQueryClient();
  let calls = 0;
  const mutation = client.getMutationCache().build(client, {
    mutationFn: async () => {
      calls++;
      throw new Error("timeout");
    },
  });
  await assert.rejects(mutation.execute({}), /timeout/);
  assert.equal(calls, 1);
  client.clear();
});

test("payment polling stops only on bank data and backs off on errors", async () => {
  const { paymentQueryOptions } =
    await import("../src/web/pdv/usePixStatus.mjs");
  const options = paymentQueryOptions(
    ["payment", "store", "operator", "id"],
    "id",
  );
  assert.equal(options.initialData, undefined);
  assert.equal(options.retry, false);
  assert.equal(options.refetchInterval({ state: {} }), 5000);
  assert.equal(
    options.refetchInterval({ state: { error: new Error("offline") } }),
    15000,
  );
  assert.equal(
    options.refetchInterval({ state: { data: { paymentStatus: "PAGO" } } }),
    false,
  );
});

test("locale preference uses Zustand and preserves translation semantics", async () => {
  const { localeStore, setLocale, translate } =
    await import("../src/web/i18n/runtime.mjs");
  setLocale("en-US");
  assert.equal(localeStore.getState().locale, "en-US");
  assert.equal(translate("common.save"), "Save");
  assert.equal(storage.get("conflora.locale"), "en-US");
  setLocale("pt-BR");
});
