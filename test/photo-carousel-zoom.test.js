process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const {
  buildMultipleOptimizedFirestorePhotoDocuments,
} = require('../src/catalog/product-photo.service');
const { createApp } = require('../src/http/app');
const { renderHomeHtml } = require('../src/http/views-home');

// Helper para criar imagens sintéticas de teste
async function createTestImage(width = 1600, height = 1200, color = { r: 34, g: 197, b: 94 }) {
  return await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

test('1. Múltiplas fotos por produto no FirestoreRepository e preservação de qualidade para zoom', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });

  // Cria 3 fotos de alta resolução simulando diferentes ângulos de uma muda de planta
  const img1 = await createTestImage(1800, 1350, { r: 22, g: 163, b: 74 }); // Verde (Visão Geral)
  const img2 = await createTestImage(1600, 1200, { r: 202, g: 138, b: 4 }); // Amarelo (Tronco/Enxerto)
  const img3 = await createTestImage(1500, 1500, { r: 239, g: 68, b: 68 }); // Vermelho (Folhagem/Flor)

  const photosBase64 = [
    img1.toString('base64'),
    img2.toString('base64'),
    img3.toString('base64'),
  ];

  await repo.saveProduct({
    id: 'prod-multi-01',
    name: 'Ipê Amarelo Cascudo (Muda Alta)',
    category: 'Plantas / Mudas',
    subcategory: 'Árvores Nativas',
    price: 120.0,
    photosBase64,
  });

  const saved = await repo.getProductById('prod-multi-01');
  assert.ok(saved);
  assert.equal(saved.images.length, 3, 'Produto deve conter as 3 URLs de fotos');
  assert.equal(saved.imageUrl, '/api/images/img_prod-multi-01');
  assert.equal(saved.images[0], '/api/images/img_prod-multi-01');
  assert.equal(saved.images[1], '/api/images/img_prod-multi-01_1');
  assert.equal(saved.images[2], '/api/images/img_prod-multi-01_2');

  // Verifica que cada documento de foto foi salvo com padrão de nomes e tags Conflora
  const photo1 = await repo.getProductPhoto('img_prod-multi-01');
  assert.ok(photo1);
  assert.equal(photo1.fileName, 'ipe-amarelo-cascudo-muda-alta_prod-multi-01.jpg');
  assert.ok(photo1.tagsAi.includes('ipê') || photo1.tagsAi.includes('árvores nativas'));
  assert.ok(photo1.sizeBytes < img1.length, 'Foto 1 deve ser otimizada');

  const photo2 = await repo.getProductPhoto('img_prod-multi-01_1');
  assert.ok(photo2);
  assert.equal(photo2.fileName, 'ipe-amarelo-cascudo-muda-alta_prod-multi-01_1.jpg');

  const photo3 = await repo.getProductPhoto('img_prod-multi-01_2');
  assert.ok(photo3);
  assert.equal(photo3.fileName, 'ipe-amarelo-cascudo-muda-alta_prod-multi-01_2.jpg');

  // Consulta por getProductPhotos
  const allProductPhotos = await repo.getProductPhotos('prod-multi-01');
  assert.equal(allProductPhotos.length, 3);
  assert.equal(allProductPhotos[0].index, 0);
  assert.equal(allProductPhotos[1].index, 1);
  assert.equal(allProductPhotos[2].index, 2);
});

test('2. Preservação de nitidez para zoom sem estourar o limite de 1MB do Firestore', async () => {
  // Foto 2000x1500 em alta definição
  const highResImg = await createTestImage(2000, 1500, { r: 15, g: 118, b: 110 });

  const docs = await buildMultipleOptimizedFirestorePhotoDocuments(
    {
      id: 'prod-zoom-01',
      name: 'Samambaia Americana Cuia 21',
      category: 'Plantas / Mudas',
    },
    [highResImg.toString('base64')],
    { contentType: 'image/jpeg', preserveZoomQuality: true }
  );

  assert.equal(docs.length, 1);
  const doc = docs[0];

  assert.ok(doc.compression, 'Deve conter metadados de compressão');
  // Verifica que a largura mantida é de alta resolução (1600px) ideal para zoom
  assert.equal(doc.width, 1600);
  assert.equal(doc.height, 1200);

  // Firestore aceita até 1.048.576 bytes por documento
  assert.ok(doc.sizeBytes < 800000, 'Tamanho no Firestore deve ser seguro (< 800KB)');
  assert.ok(doc.sizeBytes > 2000, 'Tamanho deve reter dados visuais reais');
});

test('3. API HTTP POST /api/admin/products/:id/photos salva múltiplas fotos com qualidade para zoom', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });
  await repo.saveProduct({
    id: 'prod-http-multi-01',
    name: 'Rosa do Deserto Adenium Flor Dobrada',
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
    // 1. Login admin
    const loginRes = await fetch(`http://127.0.0.1:${port}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr-edmar', pin: '1234' }),
    });
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];

    // 2. Upload de 2 fotos em alta definição
    const imgA = await createTestImage(1400, 1050, { r: 244, g: 63, b: 94 });
    const imgB = await createTestImage(1400, 1050, { r: 168, g: 85, b: 247 });

    const uploadRes = await fetch(`http://127.0.0.1:${port}/api/admin/products/prod-http-multi-01/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({
        photosBase64: [imgA.toString('base64'), imgB.toString('base64')],
        contentType: 'image/jpeg',
      }),
    });

    const uploadData = await uploadRes.json();
    assert.equal(uploadRes.status, 200);
    assert.equal(uploadData.success, true);
    assert.ok(uploadData.photos && uploadData.photos.length === 2);
    assert.equal(uploadData.photos[0].fileName, 'rosa-do-deserto-adenium-flor-dobrada_prod-http-multi-01.jpg');
    assert.equal(uploadData.photos[1].fileName, 'rosa-do-deserto-adenium-flor-dobrada_prod-http-multi-01_1.jpg');

    // 3. Verifica entrega pública via GET /api/images/:id
    const imgRes1 = await fetch(`http://127.0.0.1:${port}${uploadData.photos[0].url}`);
    assert.equal(imgRes1.status, 200);
    assert.equal(imgRes1.headers.get('content-type'), 'image/jpeg');

    const imgRes2 = await fetch(`http://127.0.0.1:${port}${uploadData.photos[1].url}`);
    assert.equal(imgRes2.status, 200);
    assert.equal(imgRes2.headers.get('content-type'), 'image/jpeg');

    // 4. Verifica rota de consulta de fotos do produto
    const photosQueryRes = await fetch(`http://127.0.0.1:${port}/api/products/prod-http-multi-01/photos`);
    assert.equal(photosQueryRes.status, 200);
    const photosQueryData = await photosQueryRes.json();
    assert.equal(photosQueryData.success, true);
    assert.equal(photosQueryData.count, 2);
  } finally {
    server.close();
  }
});

test('4. HTML do Catálogo contém elementos do Carrossel de Fotos e Visualizador de Zoom', () => {
  const html = renderHomeHtml({ products: [] });

  // Carrossel
  assert.ok(html.includes('id="modalCarouselContainer"'), 'Deve conter container do carrossel');
  assert.ok(html.includes('id="modalCarouselViewport"'), 'Deve conter viewport do carrossel');
  assert.ok(html.includes('id="carouselPrevBtn"'), 'Deve conter botão de foto anterior');
  assert.ok(html.includes('id="carouselNextBtn"'), 'Deve conter botão de próxima foto');
  assert.ok(html.includes('id="carouselCounterBadge"'), 'Deve conter indicador numérico de fotos');
  assert.ok(html.includes('id="carouselDotsRow"'), 'Deve conter bolinhas de paginação do carrossel');
  assert.ok(html.includes('id="modalThumbsRow"'), 'Deve conter linha de miniaturas');

  // Zoom
  assert.ok(html.includes('id="photoZoomModal"'), 'Deve conter modal de zoom interativo');
  assert.ok(html.includes('id="zoomViewport"'), 'Deve conter viewport de pan e zoom');
  assert.ok(html.includes('id="zoomModalImg"'), 'Deve conter imagem de alta definição com zoom');
  assert.ok(html.includes('onclick="zoomIn()"'), 'Deve conter botão de aproximar zoom');
  assert.ok(html.includes('onclick="zoomOut()"'), 'Deve conter botão de afastar zoom');
  assert.ok(html.includes('onclick="resetZoom()"'), 'Deve conter botão de redefinir zoom 100%');
  assert.ok(html.includes('onclick="closePhotoZoom()"'), 'Deve conter botão de fechar zoom');
  assert.ok(html.includes('setCarouselPhoto'), 'Deve conter função de controle do carrossel');
  assert.ok(html.includes('openPhotoZoom'), 'Deve conter função de abertura do zoom');
});
