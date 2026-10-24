const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const { getProductImageCandidates, getCashierProductImageCandidates } = require('../src/http/app');
const { actualPhotoFixture } = require('./helpers/actual-photo-fixture');

test('catalogue and cashier use Storage paths and only create image proxies for registered photo IDs', () => {
  const product = {
    id: 'plant-with-photo',
    name: 'Samambaia',
    category: 'Plantas / Mudas',
    ...actualPhotoFixture('plant-with-photo'),
  };
  const expected = [actualPhotoFixture('plant-with-photo').imageUrl];
  assert.deepEqual(getProductImageCandidates(product), expected);
  assert.deepEqual(getCashierProductImageCandidates(product), expected);

  const missing = getProductImageCandidates({ id: 'no-photo', name: 'Abiu Amarelo', category: 'Frutífera' });
  assert.equal(missing.length, 0);
  assert.deepEqual(getProductImageCandidates({ id: 'legacy-photo', imageFileId: 'photo-doc' }), []);
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
