const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { buildOptimizedFirestorePhotoDocument } = require('../src/catalog/product-photo.service');

test('product uploads preserve the original bytes and dimensions when requested', async () => {
  const original = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#35a263' } }).png().toBuffer();
  const photo = await buildOptimizedFirestorePhotoDocument({ id: 'original-test', name: 'Foto original' }, { base64Data: original.toString('base64'), contentType: 'image/png', preserveOriginal: true });
  assert.deepEqual(Buffer.from(photo.data, 'base64'), original);
  assert.equal(photo.contentType, 'image/png');
  assert.equal(photo.compression, undefined);
});
