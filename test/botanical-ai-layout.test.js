process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { BotanicalConsultantService } = require('../src/ai/botanical-consultant');
const { createApp } = require('../src/http/app');
const { FirestoreRepository } = require('../src/database/firestore.repository');





test('3. BACKEND API: BOTANICAL CONSULTANT SERVICE & ROTA POST /api/ai/botanical-consultant', async () => {
  // Teste de serviço isolado
  const sampleCatalog = [
    { id: 'p1', name: 'Zamioculca Zamiifolia', subcategory: 'Plantas de Sombra', category: 'Plantas / Mudas', price: 45.0 },
    { id: 'p2', name: 'Muda de Jabuticaba Sabará', subcategory: 'Frutíferas para Vasos', category: 'Frutíferas', price: 85.0 },
    { id: 'p3', name: 'Manjericão Italiano Roxo', subcategory: 'Horta & Temperos', category: 'Horta & Temperos', price: 12.0 },
    { id: 'p4', name: 'Substrato Especial com Casca de Arroz', subcategory: 'Adubos & Substratos', category: 'Adubos & Substratos', price: 25.0 },
  ];

  const sombraConsult = await BotanicalConsultantService.consult({
    query: 'Qual planta aguenta ambiente de sombra dentro de casa?',
    catalogProducts: sampleCatalog,
  });

  assert.equal(sombraConsult.success, true);
  assert.equal(sombraConsult.intent, 'SOMBRA');
  assert.ok(sombraConsult.reply.includes('sombra'));
  assert.ok(sombraConsult.recommendations.length > 0);
  assert.equal(sombraConsult.recommendations[0].id, 'p1');

  // Teste de Rota HTTP
  const repo = new FirestoreRepository({ isInMemory: true });
  await repo.saveProduct({
    id: 'prod-horta-01',
    name: 'Alecrim Aromático em Vaso',
    category: 'Horta & Temperos',
    price: 18.0,
  });

  const app = createApp({ messageService: { firestoreRepo: repo } });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/ai/botanical-consultant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Tem alecrim para tempero?' }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.reply);
    assert.ok(data.recommendations);
    assert.ok(data.recommendations.some(p => p.name.includes('Alecrim')));
  } finally {
    server.close();
  }
});
