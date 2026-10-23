const test = require('node:test');
const assert = require('node:assert/strict');
const { ImageMigrationService } = require('../src/catalog/image-migration.service');

test('ImageMigrationService classifies image status correctly', () => {
  const service = new ImageMigrationService();

  assert.equal(
    service.classifyImageStatus({}, 'https://firebasestorage.googleapis.com/v0/b/confloraai.appspot.com/o/products/1.jpg'),
    'STORAGE_VALIDATED'
  );

  assert.equal(
    service.classifyImageStatus({}, '/store-assets/products/alface.jpg'),
    'LOCAL_APPROVED'
  );

  assert.equal(
    service.classifyImageStatus({}, 'https://images.unsplash.com/photo-12345'),
    'EXTERNAL_APPROVED'
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
  assert.equal(audit.stats.STORAGE_VALIDATED, 1);
  assert.equal(audit.stats.LOCAL_APPROVED, 1);
  assert.equal(audit.stats.IMAGE_MISSING, 1);

  const batchResults = await service.processMigrationBatch(sampleProducts, { dryRun: true });
  assert.equal(batchResults.length, 3);
  assert.equal(batchResults[0].action, 'ALREADY_VALIDATED_IN_STORAGE');
  assert.equal(batchResults[1].action, 'DRY_RUN_WOULD_MIGRATE');
});
