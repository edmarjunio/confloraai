const test = require("node:test");
const assert = require("node:assert/strict");
const {
  toProduct,
  normalizeExistingCheckout,
  installExistingStore,
} = require("../src/storefront/existing-store");

test("main storefront API returns safe JSON when a service fails", async (t) => {
  const express = require("express");
  const app = express();
  app.use(express.json());
  installExistingStore(app, {
    repository: { getAllProducts: async () => [], storefrontSettings: {config:{ ...require('../config/stores/conflora.json'), assistant: {enabled:true,mode:'AI'} }} },
    assistant: {
      recommend: async () => {
        throw new Error("private provider details");
      },
    },
  });
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/storefront/assistant`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Planta" }),
    },
  );
  assert.equal(response.status, 503);
  assert.match(response.headers.get("content-type"), /application\/json/);
  const body = await response.json();
  assert.match(body.error, /temporariamente indisponível/);
  assert.ok(!body.error.includes("private provider"));
});

test("existing catalogue maps photos, specifications and categories without exposing private fields", () => {
  const product = toProduct({
    id: "plant",
    name: "Manjericão",
    price: 6,
    category: "Horta",
    stockQuantity: 5,
    ...require('./helpers/actual-photo-fixture').actualPhotoFixture('plant'),
    contentProvenance: { kind: 'STAFF_CONFIRMED', confirmedBy: 'isolated-staff', confirmedAt: '2026-10-23', fields: ['specifications'] },
    specifications: { light: { label: "Luz", value: "Sol" }, invalid: "value" },
    supplierCost: 1,
  });
  assert.equal(product.price.amountMinor, 600);
  assert.equal(product.imageUrl, require('./helpers/actual-photo-fixture').actualPhotoFixture('plant').imageUrl);
  assert.equal(product.images.length, 2);
  assert.equal(product.images[1], "/api/images/img_plant");
  assert.equal(product.specifications.light.value, "Sol");
  assert.equal(product.specifications.invalid, undefined);
  assert.equal(product.supplierCost, undefined);
});

test("main catalogue leaves absent photos empty and only accepts confirmed product photographs", () => {
  const illustrative = toProduct({
    id: "avocado-no-photo",
    name: "ABACATE KG",
    category: "Hortifrutti",
  });
  assert.equal(illustrative.imageIsIllustrative, false);
  assert.equal(illustrative.imageUrl, '');
  assert.equal(illustrative.actualPhotoPending, true);

  const registered = toProduct({
    id: "avocado-photo",
    name: "ABACATE KG",
    category: "Hortifrutti",
    ...require('./helpers/actual-photo-fixture').actualPhotoFixture('avocado-photo'),
  });
  assert.equal(registered.imageUrl, require('./helpers/actual-photo-fixture').actualPhotoFixture('avocado-photo').imageUrl);
  assert.equal(registered.imageIsIllustrative, false);
});

test("Storage paths remain usable and missing photos do not create fake product-id requests", () => {
  const stored = toProduct({
    id: "stored-plant",
    name: "Samambaia",
    category: "Plantas / Mudas",
    ...require('./helpers/actual-photo-fixture').actualPhotoFixture('stored-plant'),
  });
  assert.equal(stored.imageUrl, require('./helpers/actual-photo-fixture').actualPhotoFixture('stored-plant').imageUrl);
  assert.deepEqual(stored.images, [stored.imageUrl, '/api/images/img_stored-plant']);
  assert.equal(stored.imageIsIllustrative, false);

  const missing = toProduct({ id: "without-photo", name: "Abiu Amarelo", category: "Frutífera" });
  assert.ok(!missing.imageUrl.includes("/api/images/without-photo"));
  assert.equal(missing.imageIsIllustrative, false);
  assert.equal(missing.actualPhotoPending, true);
});

test("untracked stock allows zero-stock sales but never inactive products", async () => {
  let enabled = false;
  let status = "ATIVO";
  const repository = {
    storefrontSettings: new (require('./helpers/repository-fixture').FirestoreRepository)({ isInMemory: true }).storefrontSettings,
    getInventorySettings: async () => ({ stockControlEnabled: enabled }),
    getAllProducts: async () => [{ id: "plant", name: "Planta", price: 6, stockQuantity: 0, status }],
  };
  const request = () => ({ path: "/api/storefront/orders", body: {
    customer: { name: "Cliente", phone: "64999999999" }, fulfillment: "pickup", paymentMethod: "PIX",
    items: [{ productId: "plant", quantity: 2 }],
  } });
  const req = request();
  await normalizeExistingCheckout(req, repository);
  assert.equal(req.body.subtotal, 12);
  status = " inativo ";
  await assert.rejects(normalizeExistingCheckout(request(), repository), /indisponível/);
  status = "ATIVO";
  enabled = true;
  await assert.rejects(normalizeExistingCheckout(request(), repository), /indisponível/);
});

test("new main checkout uses authoritative legacy prices and rejects excessive combined quantities", async () => {
  const repository = {
    storefrontSettings: new (require('./helpers/repository-fixture').FirestoreRepository)({ isInMemory: true }).storefrontSettings,
    getInventorySettings: async () => ({ stockControlEnabled: true }),
    getAllProducts: async () => [
      { id: "plant", name: "Manjericão", price: 6, stockQuantity: 3 },
    ],
  };
  const body = {
    customer: { name: "Cliente", phone: "(64) 99999-9999" },
    fulfillment: "pickup",
    paymentMethod: "PIX",
    items: [{ productId: "plant", quantity: 2, price: 0.01 }],
    subtotal: 0.01,
  };
  const req = { path: "/api/storefront/orders", body };
  await normalizeExistingCheckout(req, repository);
  assert.equal(req.body.subtotal, 12);
  assert.equal(req.body.items[0].productId, "plant");
  assert.equal(req.body.customerPhone, "64999999999");
  await assert.rejects(
    normalizeExistingCheckout(
      {
        path: req.path,
        body: { ...body, items: [...body.items, ...body.items] },
      },
      repository,
    ),
    /indisponível/,
  );
  await assert.rejects(
    normalizeExistingCheckout(
      {
        path: req.path,
        body: { ...body, fulfillment: "delivery", address: "" },
      },
      repository,
    ),
    /endereço/,
  );
});
