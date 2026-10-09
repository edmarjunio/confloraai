process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const {
  PRESETS,
  compressImageBuffer,
  compressImageBase64,
  compressProductPhoto,
  getImageMetadata,
} = require('../src/catalog/image-compressor');
const {
  buildFirestorePhotoDocument,
  buildOptimizedFirestorePhotoDocument,
} = require('../src/catalog/product-photo.service');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { createApp } = require('../src/http/app');

// Gera uma imagem sintética colorida de teste (1600x1200 pixels)
async function createTestImage(width = 1600, height = 1200) {
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 34, g: 197, b: 94 },
    },
  })
    .png()
    .toBuffer();
}

test('1. Compressão e redimensionamento de Buffer de imagem (1600x1200 -> max 800)', async () => {
  const originalBuffer = await createTestImage(1600, 1200);
  assert.ok(originalBuffer.length > 10000, 'Buffer original deve ter mais de 10KB');

  const result = await compressImageBuffer(originalBuffer, {
    maxWidth: 800,
    maxHeight: 800,
    quality: 80,
  });

  assert.equal(result.wasCompressed, true);
  assert.equal(result.contentType, 'image/jpeg');
  assert.equal(result.width, 800);
  assert.equal(result.height, 600); // 1600x1200 reduzido proporcionalmente mantendo proporção 4:3
  assert.ok(result.compressedSizeBytes < originalBuffer.length, 'Imagem comprimida deve ser menor');
  assert.ok(result.savingsPercent > 50, 'Economia deve ser expressiva (> 50%)');
  assert.ok(result.base64 && result.base64.length > 0);
  assert.ok(result.dataUrl.startsWith('data:image/jpeg;base64,'));
});

test('2. Presets de catálogo: Thumbnail, Catalog e WebP', async () => {
  const originalBuffer = await createTestImage(1200, 1200);

  // Thumbnail
  const thumbResult = await compressImageBuffer(originalBuffer, PRESETS.THUMBNAIL);
  assert.equal(thumbResult.width, 320);
  assert.equal(thumbResult.height, 320);
  assert.equal(thumbResult.contentType, 'image/jpeg');

  // WebP
  const webpResult = await compressImageBuffer(originalBuffer, PRESETS.WEBP);
  assert.equal(webpResult.width, 800);
  assert.equal(webpResult.height, 800);
  assert.equal(webpResult.contentType, 'image/webp');
});

test('3. Compressão via Base64 e Data URL', async () => {
  const originalBuffer = await createTestImage(1000, 1000);
  const dataUrlInput = `data:image/png;base64,${originalBuffer.toString('base64')}`;

  const result = await compressImageBase64(dataUrlInput, {
    maxWidth: 600,
    maxHeight: 600,
    quality: 75,
  });

  assert.equal(result.wasCompressed, true);
  assert.equal(result.width, 600);
  assert.equal(result.height, 600);
  assert.ok(result.compressedSizeBytes < originalBuffer.length);
  assert.ok(result.dataUrl.startsWith('data:image/jpeg;base64,'));
});

test('4. Otimização de documento de foto do Firestore (compressProductPhoto)', async () => {
  const originalBuffer = await createTestImage(1200, 900);
  const rawBase64 = originalBuffer.toString('base64');

  const photoDoc = buildFirestorePhotoDocument(
    { id: 'prod-opt-01', name: 'Muda de Jabuticaba Enxertada' },
    { base64Data: rawBase64, contentType: 'image/png' }
  );

  assert.equal(photoDoc.contentType, 'image/png');
  const initialSize = photoDoc.sizeBytes;

  const optimizedDoc = await compressProductPhoto(photoDoc, {
    maxWidth: 800,
    maxHeight: 800,
  });

  assert.ok(optimizedDoc.compression, 'Deve conter bloco de compressão');
  assert.ok(optimizedDoc.sizeBytes < initialSize, 'Tamanho no Firestore deve ser reduzido');
  assert.ok(optimizedDoc.compression.savingsPercent > 50);
  assert.equal(optimizedDoc.compression.width, 800);
  assert.equal(optimizedDoc.compression.height, 600);
});

test('5. buildOptimizedFirestorePhotoDocument integra compressão com padrão Conflora', async () => {
  const originalBuffer = await createTestImage(1400, 1050);
  const rawBase64 = originalBuffer.toString('base64');

  const doc = await buildOptimizedFirestorePhotoDocument(
    {
      id: 'prod-opt-02',
      name: 'Palmeira Azul Bismarckia',
      category: 'Plantas / Mudas',
      subcategory: 'Palmeiras',
    },
    {
      base64Data: rawBase64,
      contentType: 'image/png',
      maxWidth: 800,
    }
  );

  assert.equal(doc.id, 'img_prod-opt-02');
  assert.equal(doc.fileName, 'palmeira-azul-bismarckia_prod-opt-02.jpg');
  assert.ok(doc.tagsAi.includes('bismarckia nobilis'));
  assert.ok(doc.compression, 'Deve conter metadados de compressão');
  assert.ok(doc.compression.savingsPercent > 50);
  assert.equal(doc.width, 800);
  assert.equal(doc.height, 600);
});

test('6. Resiliência: imagens minúsculas (<1KB) e SVG são preservadas sem erro', async () => {
  // 1x1 test fixture
  const sample1x1 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  const res1x1 = await compressImageBase64(sample1x1);
  assert.equal(res1x1.wasCompressed, false);
  assert.equal(res1x1.base64, sample1x1, 'Fixture minúscula deve ser mantida idêntica');

  // SVG
  const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>');
  const resSvg = await compressImageBuffer(svgBuffer);
  assert.equal(resSvg.wasCompressed, false);
  assert.equal(resSvg.contentType, 'image/svg+xml');
});

test('7. API HTTP POST /api/admin/images/compress comprime imagens sob demanda', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });
  const fakeMessageService = {
    firestoreRepo: repo,
    catalogRepo: null,
    whatsappClient: null,
  };

  const app = createApp({ messageService: fakeMessageService });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    // Login admin
    const loginRes = await fetch(`http://127.0.0.1:${port}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr-edmar', pin: '1234' }),
    });
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];

    const originalBuffer = await createTestImage(1000, 800);
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/images/compress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({
        imageBase64: originalBuffer.toString('base64'),
        maxWidth: 500,
        quality: 75,
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.wasCompressed, true);
    assert.equal(data.width, 500);
    assert.equal(data.height, 400);
    assert.ok(data.savingsPercent > 50);
  } finally {
    server.close();
  }
});

test('8. Upload via POST /api/admin/products/:id/photo comprime foto e retorna estatísticas', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });
  await repo.saveProduct({
    id: 'prod-photo-comp-01',
    name: 'Bouganville Trepadeira Rosa',
    category: 'Plantas / Mudas',
  });

  const fakeMessageService = {
    firestoreRepo: repo,
    catalogRepo: null,
    whatsappClient: null,
  };

  const app = createApp({ messageService: fakeMessageService });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    // Login admin
    const loginRes = await fetch(`http://127.0.0.1:${port}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr-edmar', pin: '1234' }),
    });
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];

    // Upload de foto em alta definição
    const originalBuffer = await createTestImage(1200, 900);
    const uploadRes = await fetch(`http://127.0.0.1:${port}/api/admin/products/prod-photo-comp-01/photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({
        photoBase64: originalBuffer.toString('base64'),
        contentType: 'image/png',
        maxWidth: 800,
        maxHeight: 800,
      }),
    });

    const uploadData = await uploadRes.json();
    assert.equal(uploadRes.status, 200);
    assert.equal(uploadData.success, true);
    assert.equal(uploadData.photo.fileName, 'bouganville-trepadeira-rosa_prod-photo-comp-01.jpg');
    assert.ok(uploadData.photo.compression, 'Deve retornar dados de compressão');
    assert.ok(uploadData.photo.compression.savingsPercent > 50);

    // Verifica que a foto gravada no repositório foi comprimida
    const savedPhoto = await repo.getProductPhoto('img_prod-photo-comp-01');
    assert.ok(savedPhoto);
    assert.ok(savedPhoto.sizeBytes < originalBuffer.length);
    assert.equal(savedPhoto.contentType, 'image/jpeg');
  } finally {
    server.close();
  }
});

test('9. Leitura de metadados de imagem via getImageMetadata', async () => {
  const testBuffer = await createTestImage(800, 600);
  const meta = await getImageMetadata(testBuffer);

  assert.ok(meta);
  assert.equal(meta.width, 800);
  assert.equal(meta.height, 600);
  assert.equal(meta.format, 'png');
});
