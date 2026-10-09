process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const {
  slugify,
  generateStandardPhotoName,
  generateStandardTags,
  generateStandardDescription,
  isGoogleDrivePath,
  extractDriveFileId,
  buildFirestorePhotoDocument,
} = require('../src/catalog/product-photo.service');
const { createApp } = require('../src/http/app');

test('1. Padrão oficial de nomes de arquivo e tags botânicas', () => {
  // Slugify
  assert.equal(slugify('Palmeira Rabo de Raposa (Muda Média)'), 'palmeira-rabo-de-raposa-muda-media');
  assert.equal(slugify('ALFACE CABEÇA / AMERICANA'), 'alface-cabeca-americana');
  assert.equal(slugify('ABACATE KG'), 'abacate-kg');

  // Nome padrão: {slug}_{id}.jpg
  const fileName = generateStandardPhotoName('Palmeira Rabo de Raposa', 'prod-01');
  assert.equal(fileName, 'palmeira-rabo-de-raposa_prod-01.jpg');

  // Tags padronizadas com enriquecimento oficial Conflora
  const raboDeRaposaTags = generateStandardTags({
    name: 'Palmeira Rabo de Raposa (Muda Média)',
    category: 'Plantas / Mudas',
    subcategory: 'Palmeiras',
  });
  assert.ok(raboDeRaposaTags.tagsString.includes('palmeira rabo de raposa'));
  assert.ok(raboDeRaposaTags.tagsString.includes('wodyetia bifurcata'));
  assert.ok(raboDeRaposaTags.tagsString.includes('palmeira australiana'));
  assert.ok(raboDeRaposaTags.tagsList.length >= 3);

  const abacateTags = generateStandardTags({
    name: 'ABACATE KG',
    category: 'Hortifrutti',
    subcategory: 'Frutas',
  });
  assert.ok(abacateTags.tagsString.includes('abacate kg'));
  assert.ok(abacateTags.tagsString.includes('fruta'));
  assert.ok(abacateTags.tagsString.includes('hortifruti'));

  // Descrição botânica
  const desc = generateStandardDescription({
    name: 'Areca Bambu',
    category: 'Plantas / Mudas',
    subcategory: 'Palmeiras',
  });
  assert.ok(desc.includes('Areca Bambu'));
  assert.ok(desc.includes('Conflora'));
});

test('2. Detecção precisa de caminhos e identificadores do Google Drive', () => {
  // URLs do Google Drive
  assert.equal(isGoogleDrivePath('https://drive.google.com/file/d/1a2b3c4d5e/view'), true);
  assert.equal(isGoogleDrivePath('https://drive.google.com/open?id=xyz789'), true);
  assert.equal(isGoogleDrivePath('https://drive.google.com/uc?id=file123'), true);

  // Identificadores de arquivo
  assert.equal(isGoogleDrivePath('drive-file-rabo-de-raposa-01'), true);
  assert.equal(extractDriveFileId('drive-file-rabo-de-raposa-01'), 'rabo-de-raposa-01');
  assert.equal(extractDriveFileId('https://drive.google.com/file/d/12345abcdef/view'), '12345abcdef');

  // Pastas típicas do AppSheet / Google Drive na planilha
  assert.equal(isGoogleDrivePath('Produtos_Images/311428b7.jpg'), true);
  assert.equal(isGoogleDrivePath('Images/palmeira-01.png'), true);
  assert.equal(isGoogleDrivePath('foto_muda.jpg'), true);

  // URLs web normais não são caminhos de Drive
  assert.equal(isGoogleDrivePath('https://images.unsplash.com/photo-12345?w=800'), false);
  assert.equal(isGoogleDrivePath('https://example.com/foto.jpg'), false);
  assert.equal(isGoogleDrivePath(''), false);
});

test('3. Importação da planilha com caminhos do Google Drive transfere fotos pro Firestore com padrão de nomes e tags', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });

  const planilhaComDrive = [
    {
      'Product ID': 'prod-drive-01',
      DESCRIÇÃO: 'Palmeira Azul Bismarckia',
      CATEGORIA: 'Plantas / Mudas',
      SUBCATEGORIA: 'Palmeiras',
      VALOR: 'R$ 190,00',
      STATUS: 'ATIVO',
      ImageURL: 'Produtos_Images/palmeira-azul.jpg',
      ImageFileId: 'drive-file-bismarckia-01',
    },
    {
      'Product ID': 'prod-drive-02',
      DESCRIÇÃO: 'Alface Crespa Hidropônica',
      CATEGORIA: 'Horta',
      SUBCATEGORIA: 'Folhosas',
      VALOR: 'R$ 8,00',
      STATUS: 'ATIVO',
      CAMINHO_FOTO: 'https://drive.google.com/file/d/1q2w3e4r5t/view',
    },
  ];

  const result = await repo.importSpreadsheetData({
    type: 'products',
    records: planilhaComDrive,
  });

  assert.equal(result.success, true);
  assert.equal(result.count, 2);

  // Verifica que os produtos foram salvos
  const p1 = await repo.getProductById('prod-drive-01');
  assert.ok(p1);
  assert.equal(p1.imageUrl, '/api/images/img_prod-drive-01');
  assert.deepEqual(p1.images, ['/api/images/img_prod-drive-01']);
  assert.ok(p1.tagsAi.includes('bismarckia nobilis') || p1.tagsAi.includes('palmeira azul'));

  // Verifica que a foto foi gravada na coleção product_images do Firestore
  const photo1 = await repo.getProductPhoto('img_prod-drive-01');
  assert.ok(photo1);
  assert.equal(photo1.productId, 'prod-drive-01');
  assert.equal(photo1.fileName, 'palmeira-azul-bismarckia_prod-drive-01.jpg');
  assert.ok(photo1.tagsAi.includes('bismarckia nobilis') || photo1.tagsAi.includes('palmeira azul'));
  assert.equal(photo1.source, 'SPREADSHEET_IMPORT');
  assert.ok(photo1.data && photo1.data.length > 0);

  const photo2 = await repo.getProductPhoto('img_prod-drive-02');
  assert.ok(photo2);
  assert.equal(photo2.fileName, 'alface-crespa-hidroponica_prod-drive-02.jpg');
  assert.ok(photo2.tagsAi.includes('alface') || photo2.tagsAi.includes('horta'));
});

test('4. No site, envio direto pro Firestore salva com o mesmo padrão de nomes e tags', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });

  // Simula imagem em base64 vinda do upload do site (1x1 pixel JPEG)
  const sampleBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  await repo.saveProduct({
    id: 'prod-web-01',
    name: 'Bouganville Primavera Rosa',
    category: 'Plantas / Mudas',
    subcategory: 'Trepadeiras e pendentes',
    price: 59.0,
    stockQuantity: 20,
    photoBase64: `data:image/jpeg;base64,${sampleBase64}`,
  });

  const savedProd = await repo.getProductById('prod-web-01');
  assert.ok(savedProd);
  assert.equal(savedProd.imageUrl, '/api/images/img_prod-web-01');
  assert.ok(savedProd.tagsAi.includes('tres marias') || savedProd.tagsAi.includes('primavera'));

  // Consulta direta da foto salva no Firestore
  const photo = await repo.getProductPhoto('img_prod-web-01');
  assert.ok(photo);
  assert.equal(photo.productId, 'prod-web-01');
  assert.equal(photo.fileName, 'bouganville-primavera-rosa_prod-web-01.jpg');
  assert.equal(photo.contentType, 'image/jpeg');
  assert.equal(photo.source, 'WEBSITE_DIRECT');
  assert.equal(photo.data, sampleBase64);
  assert.ok(photo.tagsAi.includes('tres marias') || photo.tagsAi.includes('primavera'));
});

test('5. Rota HTTP GET /api/images/:id entrega a imagem do Firestore com headers corretos', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });

  const sampleBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  const photoDoc = buildFirestorePhotoDocument({
    id: 'prod-http-01',
    name: 'Jabuticaba Sabará Enxertada',
    category: 'Frutíferas',
  }, {
    base64Data: sampleBase64,
    contentType: 'image/jpeg',
  });

  await repo.saveProductPhoto(photoDoc);

  const fakeMessageService = {
    firestoreRepo: repo,
    catalogRepo: null,
    whatsappClient: null,
  };

  const app = createApp({ messageService: fakeMessageService });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/images/${photoDoc.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/jpeg');
    assert.ok(res.headers.get('cache-control').includes('public'));
    assert.ok(res.headers.get('content-disposition').includes(photoDoc.fileName));

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    assert.equal(buffer.toString('base64'), sampleBase64);
  } finally {
    server.close();
  }
});

test('6. API administrativa transfere fotos do Drive e aceita upload direto via /api/admin/products/:id/photo', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });

  // Popula produto com caminho do Drive
  await repo.saveProduct({
    id: 'prod-mig-01',
    name: 'Cebolinha Verde da Horta',
    category: 'Horta',
    subcategory: 'Temperos e ervas',
    price: 8.0,
    imageUrl: 'Produtos_Images/cebolinha.jpg',
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
    // 1. Simula login de admin
    const loginRes = await fetch(`http://127.0.0.1:${port}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr-edmar', pin: '1234' }),
    });
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];

    // 2. Dispara transferência de fotos do Drive para o Firestore
    const transferRes = await fetch(`http://127.0.0.1:${port}/api/admin/transfer-drive-photos`, {
      method: 'POST',
      headers: { cookie },
    });
    const transferData = await transferRes.json();
    assert.equal(transferRes.status, 200);
    assert.equal(transferData.success, true);
    assert.equal(transferData.count, 1);

    // Verifica que cebolinha foi atualizada para /api/images/img_prod-mig-01
    const cebolinha = await repo.getProductById('prod-mig-01');
    assert.equal(cebolinha.imageUrl, '/api/images/img_prod-mig-01');
    assert.ok(cebolinha.tagsAi.includes('cheiro verde') || cebolinha.tagsAi.includes('cebolinha'));

    // 3. Testa upload direto no endpoint dedicado /api/admin/products/:id/photo
    const sampleBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    const uploadRes = await fetch(`http://127.0.0.1:${port}/api/admin/products/prod-mig-01/photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({
        photoBase64: sampleBase64,
        contentType: 'image/jpeg',
      }),
    });
    const uploadData = await uploadRes.json();
    assert.equal(uploadRes.status, 200);
    assert.equal(uploadData.success, true);
    assert.equal(uploadData.photo.fileName, 'cebolinha-verde-da-horta_prod-mig-01.jpg');
    assert.ok(uploadData.photo.tags.includes('cheiro verde') || uploadData.photo.tags.includes('cebolinha'));
  } finally {
    server.close();
  }
});
