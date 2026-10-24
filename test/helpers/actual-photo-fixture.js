/** Isolated photo provenance fixture; never imported by runtime or deployed assets. */
function actualPhotoFixture(productId, fileName = 'main.jpg') {
  const bucket = require('../../src/config/env').firebase.storageBucket;
  const imagePath = `products/${productId}/${fileName}`;
  const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(imagePath)}?alt=media&token=isolated-photo-token`;
  return { imageUrl, images: [imageUrl], imagePath, imagePaths: [imagePath], imageFileId: `img_${productId}`,
    imageProvenance: { kind: 'CONFLORA_ACTUAL_PRODUCT', confirmedBy: 'isolated-staff', confirmedAt: '2026-10-23T12:00:00Z', storagePaths: [imagePath] } };
}
module.exports = { actualPhotoFixture };

function isolatedPhotoStorage() {
  return {
    uploadProductImage: async ({ productId, fileName, buffer }) => {
      if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Isolated upload requires fixture bytes.');
      const fixture = actualPhotoFixture(productId, fileName);
      return { imagePath: fixture.imagePath, imageUrl: fixture.imageUrl };
    },
    deleteProductImage: async () => true,
  };
}
module.exports.isolatedPhotoStorage = isolatedPhotoStorage;
