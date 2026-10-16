const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadProductCardUtilities() {
  const source = fs.readFileSync(path.join(__dirname, '../public/storefront/product-card.js'), 'utf8');
  const registry = new Map();
  const window = {};
  vm.runInNewContext(source, {
    window,
    HTMLElement: class HTMLElement {},
    customElements: {
      get: (name) => registry.get(name),
      define: (name, component) => registry.set(name, component),
    },
    document: { createElement: () => ({}) },
    Intl,
    Map,
    Set,
    URL,
    console,
  });
  return window.ConfloraProductCard;
}

test('cartão normaliza categoria legada e remove prefixo de emoji sem renderizar subcategoria', () => {
  const { getCategory } = loadProductCardUtilities();

  assert.equal(getCategory({ category: 'Frutífera / Mudas', subcategory: 'Mudas' }), 'Frutífera');
  assert.equal(getCategory({ category: '🍋 Frutífera / Mudas' }), 'Frutífera');
  assert.equal(getCategory({ category: 'Plantas / Mudas', subcategory: 'Árvores' }), 'Plantas / Mudas');
  assert.equal(getCategory({ category: 'Horta', subcategory: 'Folhosas' }), 'Horta');
  assert.equal(getCategory({ categoryName: 'Meia Sombra', category: 'Plantas / Mudas' }), 'Plantas / Mudas');
  assert.equal(getCategory({ categoryName: 'Meia Sombra Mudas' }), 'Plantas / Mudas');
  assert.equal(getCategory({ categoryName: 'O Meia Sombra' }), '');
  assert.equal(getCategory({ categoryName: 'texto antigo', categories: ['Hortifrutti'] }), 'Hortifrutti');
});
