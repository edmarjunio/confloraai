const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const { getProductImageCandidates, getCashierProductImageCandidates } = require('../src/http/app');

test('catalogue and cashier use Storage paths and only create image proxies for registered photo IDs', () => {
  const product = {
    id: 'plant-with-photo',
    name: 'Samambaia',
    category: 'Plantas / Mudas',
    imagePaths: ['products/plant-with-photo/main.jpg', 'products/plant-with-photo/detail.jpg'],
  };
  const expected = ['products/plant-with-photo/main.jpg', 'products/plant-with-photo/detail.jpg'];
  assert.deepEqual(getProductImageCandidates(product), expected);
  assert.deepEqual(getCashierProductImageCandidates(product), expected);

  const missing = getProductImageCandidates({ id: 'no-photo', name: 'Abiu Amarelo', category: 'Frutífera' });
  assert.equal(missing.length, 1);
  assert.match(missing[0], /^https:\/\/images\.unsplash\.com\//);
  assert.deepEqual(getProductImageCandidates({ id: 'legacy-photo', imageFileId: 'photo-doc' }), ['/api/images/photo-doc']);
});

test('shared product card hides a concatenated subcategory but keeps the real category Plants / Mudas', () => {
  class HTMLElement {}
  const customElements = { get: () => undefined, define: () => {} };
  const window = {};
  vm.runInNewContext(fs.readFileSync('public/storefront/product-card.js', 'utf8'), {
    HTMLElement,
    customElements,
    window,
    document: {},
    Intl,
    URL,
    Map,
    Set,
    JSON,
    Number,
    String,
    Math,
  });

  const normalize = window.ConfloraProductCard.normalizeProduct;
  assert.equal(normalize({ categoryName: 'Frutífera / Mudas', subcategoryName: 'Mudas' }).category, 'Frutífera');
  assert.equal(normalize({ category: 'Plantas / Mudas', subcategory: 'Árvores' }).category, 'Plantas / Mudas');
});
