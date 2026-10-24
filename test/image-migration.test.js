const test = require('node:test');
const assert = require('node:assert/strict');
const { ImageMigrationService } = require('../src/catalog/image-migration.service');

test('ImageMigrationService classifies image status correctly', () => {
  const service = new ImageMigrationService();

  assert.equal(
    service.classifyImageStatus({}, 'https://firebasestorage.googleapis.com/v0/b/confloraai.appspot.com/o/products/1.jpg'),
    'LICENSE_REVIEW_REQUIRED'
  );

  assert.equal(
    service.classifyImageStatus({}, '/store-assets/products/alface.jpg'),
    'LICENSE_REVIEW_REQUIRED'
  );

  assert.equal(
    service.classifyImageStatus({}, 'https://images.unsplash.com/photo-12345'),
    'LICENSE_REVIEW_REQUIRED'
  );

  assert.equal(
    service.classifyImageStatus({}, '/store-assets/placeholder.svg'),
    'IMAGE_MISSING'
  );

  assert.equal(
    service.classifyImageStatus({}, 'https://random-site.com/photo.jpg'),
    'LICENSE_REVIEW_REQUIRED'
  );
});

test('ImageMigrationService protects manual photos from being overwritten by AI', () => {
  const service = new ImageMigrationService();

  const manualProduct = { id: 'p1', name: 'Palmeira', source: 'WEBSITE_DIRECT', imageUrl: '/store-assets/products/palmeira.jpg' };
  const aiProduct = { id: 'p2', name: 'Alface', source: 'AI_ENRICHED', imageUrl: 'https://images.unsplash.com/photo-1' };

  assert.equal(service.isManualPhoto(manualProduct), true);
  assert.equal(service.isManualPhoto(aiProduct), false);
});

test('ImageMigrationService performs dry-run audit without production writes', async () => {
  const service = new ImageMigrationService();
  const sampleProducts = [
    { id: '1', name: 'Alface Crespa', category: 'Horta', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/conflora.appspot.com/o/1.jpg' },
    { id: '2', name: 'Couve Manteiga', category: 'Horta', imageUrl: '/store-assets/products/couve.jpg' },
    { id: '3', name: 'Planta Misteriosa', category: 'Plantas', imageUrl: '' },
  ];

  const audit = await service.auditCatalog(sampleProducts);
  assert.equal(audit.stats.totalProducts, 3);
  assert.equal(audit.stats.STORAGE_VALIDATED, 0);
  assert.equal(audit.stats.LICENSE_REVIEW_REQUIRED, 2);
  assert.equal(audit.stats.IMAGE_MISSING, 1);

  const batchResults = await service.processMigrationBatch(sampleProducts, { dryRun: true });
  assert.equal(batchResults.length, 3);
  assert.equal(batchResults[0].action, 'REVIEW_REQUIRED');
  assert.equal(batchResults[1].action, 'REVIEW_REQUIRED');
});

test('local migration persists photo and all image consumers without rewriting commercial fields', async () => {
  const { FirestoreRepository } = require('../src/database/firestore.repository');
  const repository = new FirestoreRepository({ isInMemory: true });
  const product = { id: 'isolated-local-image', name: 'Foto local', price: 12, stockQuantity: 7,
    tagsAi: 'foto local, preservada', descriptionAi: 'Descrição original preservada.',
    imageProvenance: { kind: 'CONFLORA_ACTUAL_PRODUCT', confirmedBy: 'isolated-staff', confirmedAt: '2026-10-24', sourcePath: '/store-assets/products/rolinha-diamante.jpg' },
    imageUrl: '/store-assets/products/rolinha-diamante.jpg', images: ['/store-assets/products/rolinha-diamante.jpg'] };
  await repository.saveProduct(product);
  const service = new ImageMigrationService({ firestoreRepo: repository, localPhotoRoot: require('node:path').resolve(__dirname, 'fixtures/images'), storage: {
    uploadProductImage: async ({ buffer }) => { assert.ok(buffer.length > 0); return { imageUrl: 'https://storage.invalid/photo.jpg', imagePath: 'products/isolated-local-image/photo.jpg' }; },
  } });
  const [result] = await service.processMigrationBatch([product], { dryRun: false });
  assert.equal(result.success, true);
  const updated = await repository.getProductById(product.id);
  assert.deepEqual(updated.images, ['https://storage.invalid/photo.jpg']);
  assert.equal(updated.imageUrl, updated.images[0]);
  assert.equal(updated.price, 12);
  assert.equal(updated.stockQuantity, 7);
  assert.equal(updated.descriptionAi, product.descriptionAi);
  assert.ok(updated.tagsAi.includes('preservada'));
  assert.equal((await repository.getProductPhoto(product.id)).source, 'MIGRATED_LOCAL');
  await assert.rejects(repository.saveProduct({ id: product.id, imageUrl: 'https://stale.invalid' }, { expectedImageUrl: product.imageUrl }), /imagem mudou/);
});
