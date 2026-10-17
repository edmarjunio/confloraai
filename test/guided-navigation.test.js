const test = require("node:test");
const assert = require("node:assert/strict");
const load = () => import("../public/storefront/guided-search.mjs");
const products = [
  {
    id: "a",
    name: "Cola resistente 2m",
    isAvailable: true,
    categories: ["tools"],
    subcategoryName: "Adesivos",
    tags: ["adesivo impermeável"],
  },
  {
    id: "b",
    name: "Cola resistente 3m",
    isAvailable: true,
    categories: ["tools"],
    subcategoryName: "Adesivos",
  },
  { id: "c", name: "Mandioca", isAvailable: true, categories: ["food"] },
  {
    id: "d",
    name: "Cola invisível",
    isAvailable: false,
    categories: ["tools"],
  },
];
const categories = [
  { id: "tools", name: "Construção", isActive: true },
  { id: "food", name: "Alimentos", isActive: true },
];
test("generic guide follows client categories and excludes inactive products", async () => {
  const { nextChoices, scopedProducts } = await load();
  assert.deepEqual(nextChoices(products, categories, ["Construção"]), [
    { name: "Adesivos", count: 2 },
  ]);
  assert.equal(
    scopedProducts(products, categories, ["Construção", "Adesivos"]).length,
    2,
  );
  assert.equal(
    scopedProducts(products, [{ ...categories[0], isActive: false }], [])
      .length,
    0,
  );
});
test("fuzzy matching accepts misspelling but never changes requested numeric size", async () => {
  const { searchProducts } = await load();
  assert.deepEqual(
    searchProducts(products, "cola rezistente 2m").map((x) => x.product.id),
    ["a"],
  );
  assert.equal(searchProducts(products, "cola resistente 9m").length, 0);
  assert.equal(searchProducts(products, "invisivel").length, 0);
});
test("synonyms come from store data and do not leak between configurations", async () => {
  const { searchProducts } = await load();
  assert.equal(searchProducts(products, "aipim").length, 0);
  assert.equal(
    searchProducts(products, "aipim", [["mandioca", "aipim", "macaxeira"]])[0]
      .product.id,
    "c",
  );
  assert.equal(searchProducts(products, "impermeavel")[0].product.id, "a");
});


test('natural shopping requests search all products and use registered light and environment', async () => {
  const { searchProducts } = await load();
  const plants = [
    { id: 'shade', name: 'Zamioculca', isAvailable: true, searchAttributes: { light: 'Luz indireta', environment: 'Ambiente interno' } },
    { id: 'sun', name: 'Girassol', isAvailable: true, searchAttributes: { light: 'Sol pleno', environment: 'Jardim externo' } },
  ];
  assert.deepEqual(searchProducts(plants, 'Preciso de ajuda para escolher uma planta de sombra').map(item => item.product.id), ['shade']);
  assert.deepEqual(searchProducts(plants, 'Quero uma planta para sala que não precise de muito sol').map(item => item.product.id), ['shade']);
});
