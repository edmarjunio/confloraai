const test = require("node:test");
const assert = require("node:assert/strict");
const {
  toProduct,
  normalizeExistingCheckout,
} = require("../src/storefront/existing-store");

test("existing catalogue maps photos, specifications and categories without exposing private fields", () => {
  const product = toProduct({
    id: "plant",
    name: "Manjericão",
    price: 6,
    category: "Horta",
    stockQuantity: 5,
    imageUrl: "/api/images/photo-1",
    images: ["/api/images/photo-2", "javascript:alert(1)"],
    specifications: { light: { label: "Luz", value: "Sol" }, invalid: "value" },
    supplierCost: 1,
  });
  assert.equal(product.price.amountMinor, 600);
  assert.equal(product.imageUrl, "/api/images/photo-1");
  assert.equal(product.images.length, 1);
  assert.equal(product.specifications.light.value, "Sol");
  assert.equal(product.specifications.invalid, undefined);
  assert.equal(product.supplierCost, undefined);
});

test("new main checkout uses authoritative legacy prices and rejects excessive combined quantities", async () => {
  const repository = {
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
