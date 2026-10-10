const test = require("node:test");
const assert = require("node:assert/strict");
const { navigationPath } = require("../src/storefront/catalog-navigation");
const navigationConfig = require("../config/stores/conflora-navigation.json");
const { toProduct } = require("../src/storefront/existing-store");
const { StoreAssistant } = require("../src/storefront/assistant");

const getGuidedSearch = async () => import("../public/storefront/guided-search.mjs");

test("catalog-navigation maps hierarchical paths according to user flow rules", () => {
  // 1. Pets -> Roedores -> Hamster
  const hamsterItem = {
    category: "Pets",
    subcategory: "Pequenos mamíferos",
    name: "HAMSTER RUSSO ANÃO",
  };
  assert.deepEqual(navigationPath(hamsterItem, navigationConfig), [
    "Pets",
    "Roedores",
    "Hamster",
  ]);

  // 2. Plantas -> Mudas -> Muda de Alface Crespa
  const alfaceItem = {
    category: "Plantas / Mudas",
    subcategory: "Hortaliças",
    name: "MUDA DE ALFACE CRESPA",
  };
  assert.deepEqual(navigationPath(alfaceItem, navigationConfig), [
    "Plantas",
    "Mudas",
    "Muda de Alface Crespa",
  ]);

  // 3. Plantas -> Palmeiras -> Palmeira Carpentária 2m
  const palmeiraItem = {
    category: "Plantas / Mudas",
    subcategory: "Palmeiras",
    name: "PALMEIRA CARPENTÁRIA 2M",
  };
  assert.deepEqual(navigationPath(palmeiraItem, navigationConfig), [
    "Plantas",
    "Palmeiras",
    "Palmeira Carpentária 2m",
  ]);

  // 4. Excluded administrative categories
  const adminItem = {
    category: "TROCO DO DIA",
    subcategory: "Administrativo",
    name: "Troco de abertura",
  };
  assert.deepEqual(navigationPath(adminItem, navigationConfig), []);

  // 5. Default mapped category and subcategory
  const florItem = {
    category: "Plantas / Mudas",
    subcategory: "Flores e floríferas",
    name: "ROSA DO DESERTO",
  };
  assert.deepEqual(navigationPath(florItem, navigationConfig), [
    "Plantas",
    "Flores",
  ]);
});

test("toProduct enriches product with navigationPath and searchAliases", () => {
  const prod = toProduct({
    id: "101",
    name: "Hamster Sírio",
    category: "Pets",
    subcategory: "Pequenos mamíferos",
    tagsAi: "hamster, roedor, filhote",
    price: 35,
  });

  assert.deepEqual(prod.navigationPath, ["Pets", "Roedores", "Hamster"]);
  assert.deepEqual(prod.searchAliases, ["hamster", "roedor", "filhote"]);
});

test("guided-search handles typos with fuzzy matching", async () => {
  const { isFuzzyMatch } = await getGuidedSearch();
  // Spelling mistakes common in Brazilian Portuguese
  assert.ok(isFuzzyMatch("hamister", "hamster"));
  assert.ok(isFuzzyMatch("ramster", "hamster"));
  assert.ok(isFuzzyMatch("alfece", "alface"));
  assert.ok(isFuzzyMatch("alfaci", "alface"));
  assert.ok(isFuzzyMatch("palmera", "palmeira"));
  assert.ok(isFuzzyMatch("hortifruti", "hortifrutti"));
});

test("guided-search expands synonyms correctly", async () => {
  const { expandSynonyms } = await getGuidedSearch();
  const synonyms = navigationConfig.synonyms;
  const expanded = expandSynonyms(["hamister"], synonyms);
  assert.ok(expanded.includes("hamster"));
  assert.ok(expanded.includes("roedores") || expanded.includes("pets"));

  const expandedHorta = expandSynonyms(["hortifruti"], synonyms);
  assert.ok(expandedHorta.includes("hortifrutti"));
  assert.ok(expandedHorta.includes("salada") || expandedHorta.includes("legumes"));
});

test("guided-search tree and product search rank matches properly", async () => {
  const {
    buildNavigationTree,
    findCategoryNode,
    searchProducts,
  } = await getGuidedSearch();

  const p1 = toProduct({
    id: "1",
    name: "Muda de Alface Crespa",
    category: "Plantas / Mudas",
    subcategory: "Hortaliças",
    price: 3.5,
    salesCount: 50,
  });
  const p2 = toProduct({
    id: "2",
    name: "Hamster Russo Anão",
    category: "Pets",
    subcategory: "Pequenos mamíferos",
    price: 45,
    salesCount: 30,
  });
  const p3 = toProduct({
    id: "3",
    name: "Palmeira Carpentária 2m",
    category: "Plantas / Mudas",
    subcategory: "Palmeiras",
    price: 180,
    salesCount: 10,
  });

  const products = [p1, p2, p3];
  const tree = buildNavigationTree(products, navigationConfig);

  assert.ok(tree.children.has("Plantas"));
  assert.ok(tree.children.has("Pets"));

  const petsNode = findCategoryNode(tree, ["Pets", "Roedores", "Hamster"]);
  assert.ok(petsNode);
  assert.equal(petsNode.products[0].id, "2");

  // Search with typo: "alfece crespa"
  const foundAlface = searchProducts(products, "alfece crespa", {
    synonyms: navigationConfig.synonyms,
  });
  assert.ok(foundAlface.length > 0);
  assert.equal(foundAlface[0].id, "1");

  // Search with typo: "hamister"
  const foundHamster = searchProducts(products, "hamister", {
    synonyms: navigationConfig.synonyms,
  });
  assert.ok(foundHamster.length > 0);
  assert.equal(foundHamster[0].id, "2");

  // Search with partial/typo: "palmera carpentaria"
  const foundPalmeira = searchProducts(products, "palmera carpentaria", {
    synonyms: navigationConfig.synonyms,
  });
  assert.ok(foundPalmeira.length > 0);
  assert.equal(foundPalmeira[0].id, "3");
});

test("StoreAssistant respects GUIDED mode and returns instant recommendations", async () => {
  const assistant = new StoreAssistant();
  const products = [
    toProduct({
      id: "1",
      name: "Muda de Alface Crespa",
      category: "Plantas / Mudas",
      subcategory: "Hortaliças",
      price: 3.5,
      isAvailable: true,
      stockQuantity: 10,
    }),
  ];

  const config = {
    assistant: { mode: "GUIDED", displayName: "Guia de compras" },
  };

  const result = await assistant.recommend(config, {}, products, {
    message: "Alface",
  });

  assert.equal(result.mode, "GUIDED");
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].name, "Muda de Alface Crespa");
  assert.ok(!result.sources.length);
});
