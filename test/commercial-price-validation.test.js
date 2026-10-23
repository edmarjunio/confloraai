const test = require('node:test');
const assert = require('node:assert/strict');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { CatalogRepository } = require('../src/catalog/catalog.repository');

test('product writes reject malformed prices and identifiers before saving documents', async () => {
  const repository = new FirestoreRepository({ isInMemory: true });
  for (const price of [null, '', '25', NaN, Infinity, -1, 10.001, Number.MAX_SAFE_INTEGER]) {
    await assert.rejects(repository.saveProduct({ id: 'invalid', name: 'Produto', price }), { status: 400 });
  }
  await assert.rejects(repository.saveProduct({ id: '../other', name: 'Produto', price: 10 }), { status: 400 });
  await assert.rejects(repository.saveProduct({ id: 'invalid', name: ' ', price: 10 }), { status: 400 });
  assert.deepEqual(await repository.getAllProducts(), []);
});

test('an unpriced inventory record never becomes a free product in the sales catalogue', async () => {
  const repository = new FirestoreRepository({ isInMemory: true });
  await repository.saveProduct({ id: 'unpriced', name: 'Produto sem preço', stockQuantity: 5 });
  await repository.saveProduct({ id: 'priced', name: 'Produto cadastrado', price: 12.5, stockQuantity: 5 });
  const catalogue = new CatalogRepository({ firestoreRepo: repository });
  await catalogue.refreshCatalog();
  assert.deepEqual(catalogue.items.map(item => item.id), ['priced']);
  assert.equal((await repository.getAllProducts()).length, 2);
  await repository.saveProduct({ id: 'unpriced', price: 15 });
  await catalogue.refreshCatalog();
  assert.equal(catalogue.items.find(item => item.id === 'unpriced').price, 15);
});
