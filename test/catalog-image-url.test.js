const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDriveDirectImageUrl } = require('../src/catalog/catalog.repository');

test('product image URLs resolve Firestore photo IDs and embeddable Google Drive links', () => {
  assert.equal(buildDriveDirectImageUrl('img_product_1', ''), '/api/images/img_product_1');
  assert.equal(
    buildDriveDirectImageUrl('img_product_1', 'https://example.com/old-photo.jpg'),
    '/api/images/img_product_1',
  );
  assert.equal(
    buildDriveDirectImageUrl('', 'https://drive.google.com/file/d/drive-photo-123/view?usp=sharing'),
    'https://drive.google.com/uc?export=view&id=drive-photo-123',
  );
  assert.equal(
    buildDriveDirectImageUrl('', 'https://images.unsplash.com/photo-123?w=800'),
    'https://images.unsplash.com/photo-123?w=800',
  );
});
