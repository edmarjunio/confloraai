const test = require('node:test');
const assert = require('node:assert/strict');
const { CatalogRepository } = require('../src/catalog/catalog.repository');

test('catalog accepts Firebase Storage images and ignores external image sources', () => {
  const repository = new CatalogRepository({
    mockData: [
      { id: 'storage', name: 'Imagem Storage', price: 1, imageUrl: 'https://firebasestorage.googleapis.com/v0/b/app/o/product.jpg?alt=media' },
      { id: 'drive', name: 'Imagem externa', price: 1, imageUrl: 'https://drive.google.com/file/d/123/view' },
      { id: 'unsplash', name: 'Imagem ilustrativa', price: 1, imageUrl: 'https://images.unsplash.com/photo-123?w=800' },
    ],
  });

  assert.deepEqual(repository.items.find((item) => item.id === 'storage').images, [
    'https://firebasestorage.googleapis.com/v0/b/app/o/product.jpg?alt=media',
  ]);
  assert.deepEqual(repository.items.find((item) => item.id === 'drive').images, []);
  assert.deepEqual(repository.items.find((item) => item.id === 'unsplash').images, []);
});
