const test = require('node:test');
const assert = require('node:assert/strict');
const { CatalogRepository } = require('./helpers/catalog-fixture');
const { actualPhotoFixture } = require('./helpers/actual-photo-fixture');

test('catalog accepts Firebase Storage images and ignores external image sources', () => {
  const repository = new CatalogRepository({
    mockData: [
      { id: 'storage', name: 'Imagem Storage', price: 1, ...actualPhotoFixture('storage') },
      { id: 'drive', name: 'Imagem externa', price: 1, imageUrl: 'https://drive.google.com/file/d/123/view' },
      { id: 'unsplash', name: 'Imagem ilustrativa', price: 1, imageUrl: 'https://images.unsplash.com/photo-123?w=800' },
    ],
  });

  assert.deepEqual(repository.items.find((item) => item.id === 'storage').images, [
    actualPhotoFixture('storage').imageUrl,
  ]);
  assert.deepEqual(repository.items.find((item) => item.id === 'drive').images, []);
  assert.deepEqual(repository.items.find((item) => item.id === 'unsplash').images, []);
});

test('Firestore image and short description are not replaced by a bundled catalog profile', () => {
  const { normalizeCatalogItem } = require('../src/catalog/normalize-catalog-item');
  const { toProduct } = require('../src/storefront/existing-store');
  const raw = { id: 'prd-060ec45a069fa5da0af839850b468bef', name: 'RÚCULA', price: 14, status: 'ATIVO', category: 'Horta',
    imageUrl: 'https://static.inaturalist.org/photos/backend-authoritative.jpg', images: ['https://static.inaturalist.org/photos/backend-authoritative.jpg'],
    description: 'Dados oficiais.', descriptionAi: 'Dados oficiais.', contentProvenance: { kind: 'STAFF_CONFIRMED', confirmedBy: 'isolated-staff', confirmedAt: '2026-10-23', fields: ['description', 'descriptionAi'] } };
  assert.equal(normalizeCatalogItem(raw).imageUrl, '');
  assert.equal(normalizeCatalogItem(raw).descriptionAi, raw.descriptionAi);
  const storefront = toProduct(raw, { stockControlEnabled: false });
  assert.equal(storefront.imageUrl, '');
  assert.equal(storefront.description, raw.description);
  assert.equal(storefront.price.amountMinor, 1400);
});
