process.env.NODE_ENV = 'test';
process.env.WHATSAPP_AI_ENABLED = 'true';
process.env.WHATSAPP_AGENT_OWNER = 'cloud_api';

const test = require('node:test');
const assert = require('node:assert/strict');

const { CatalogRepository } = require('./helpers/catalog-fixture');
const { MessageRouter } = require('../src/router/message.router');
const { DirectPriceService } = require('../src/services/direct-price.service');
const { AgentService } = require('../src/ai/agent.service');
const { FirestoreRepository } = require('./helpers/repository-fixture');
const { OrderService } = require('../src/orders/order.service');
const { LearningService } = require('../src/services/learning.service');
const { MessageService } = require('../src/services/message.service');
const { parseCurrencyString, formatCurrency } = require('../src/shared/string.util');
const { renderPrivacyPolicyHtml, renderDataDeletionHtml, renderTermsOfServiceHtml } = require('../src/http/app');

const mockProducts = [
  {
    id: '1',
    name: 'Palmeira Rabo de Raposa',
    category: 'Plantas / Mudas',
    subcategory: 'Palmeiras',
    price: 79.0,
    status: 'ATIVO',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/conflora/o/rabo-01.jpg?alt=media',
    descriptionAi: 'Palmeira ornamental de crescimento rápido para sol pleno.',
    tagsAi: 'rabo de raposa, wodyetia bifurcata, palmeira australiana',
  },
  {
    id: '2',
    name: 'Palmeira Rabo de Raposa',
    category: 'Plantas / Mudas',
    subcategory: 'Palmeiras',
    price: 195.0,
    status: 'ATIVO',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/conflora/o/rabo-02.jpg?alt=media',
    descriptionAi: 'Muda grande 2 metros.',
  },
  {
    id: '3',
    name: 'Palmeira Azul',
    category: 'Plantas / Mudas',
    subcategory: 'Palmeiras',
    price: 190.0,
    status: 'ATIVO',
    descriptionAi: 'Palmeira imponente de folhas azul-acinzentadas para jardins.',
    tagsAi: 'bismarckia nobilis, palmeira bismarckia',
  },
  {
    id: '4',
    name: 'Areca Bambu',
    category: 'Plantas / Mudas',
    subcategory: 'Palmeiras',
    price: 79.0,
    status: 'ATIVO',
  },
  {
    id: '5',
    name: 'Bouganville / Primavera',
    category: 'Plantas / Mudas',
    subcategory: 'Trepadeiras e pendentes',
    price: 59.0,
    status: 'ATIVO',
    tagsAi: 'tres marias, flor de papel',
    descriptionAi: 'Trepadeira muito florida de sol pleno.',
  },
  // Pets: Mini Cabra Macho e Fêmea
  {
    id: '6',
    name: 'MINI CABRA MACHO',
    category: 'Pets',
    subcategory: 'Pequenos mamíferos',
    price: 2900.0,
    status: 'ATIVO',
  },
  {
    id: '7',
    name: 'MINI CABRA FÊMEA',
    category: 'Pets',
    subcategory: 'Pequenos mamíferos',
    price: 3900.0,
    status: 'ATIVO',
  },
  // Horta: Alfaces e temperos
  {
    id: '8',
    name: 'ALFACE CRESPA',
    category: 'Horta',
    subcategory: 'Folhosas',
    price: 8.0,
    status: 'ATIVO',
  },
  {
    id: '9',
    name: 'ALFACE CRESPA',
    category: 'Horta',
    subcategory: 'Folhosas',
    price: 14.0,
    status: 'ATIVO',
  },
  {
    id: '10',
    name: 'ALFACE CRESPA',
    category: 'Horta',
    subcategory: 'Folhosas',
    price: 20.0,
    status: 'ATIVO',
  },
  {
    id: '11',
    name: 'ALFACE CABEÇA / AMERICANA',
    category: 'Horta',
    subcategory: 'Folhosas',
    price: 8.0,
    status: 'ATIVO',
  },
  {
    id: '12',
    name: 'RÚCULA',
    category: 'Horta',
    subcategory: 'Folhosas',
    price: 8.0,
    status: 'ATIVO',
  },
  {
    id: '13',
    name: 'CEBOLINHA',
    category: 'Horta',
    subcategory: 'Temperos e ervas',
    price: 8.0,
    status: 'ATIVO',
  },
];

function createTestMessageService(aiMock = null, captures = {}) {
  captures.images = captures.images || [];
  captures.messages = captures.messages || [];

  const firestoreRepo = new FirestoreRepository({ isInMemory: true });
  for (const product of mockProducts) firestoreRepo.inMemoryProducts.set(product.id, { ...product, stockQuantity: 100 });
  const catalogRepo = new CatalogRepository({ mockData: mockProducts, firestoreRepo });
  const router = new MessageRouter(catalogRepo);
  const directPriceService = new DirectPriceService();
  const agentService = new AgentService({ aiClient: aiMock });

  const mockWhatsapp = {
    async sendInteractiveButtons(to, content) {
      captures.messages.push({ to, text: content.bodyText });
      return { messages: [{ id: 'wamid.menu-' + captures.messages.length }] };
    },
    async sendTextMessage(to, text) {
      captures.messages.push({ to, text });
      return { messages: [{ id: 'wamid.fixture-' + captures.messages.length + '-' + captures.images.length }] };
    },
    async sendImageMessage(to, url, caption) {
      captures.images.push({ to, url, caption });
      return { messages: [{ id: 'wamid.fixture-' + captures.messages.length + '-' + captures.images.length }] };
    },
    async sendWelcomeTemplate(to) {
      captures.messages.push({ to, text: 'welcome' });
      return { messages: [{ id: 'wamid.welcome' }] };
    },
    async markAsRead(id) {
      if (!id || !id.startsWith('wamid.')) {
        return { mock: true, skippedNonMetaId: true };
      }
      return { messages: [{ id: 'wamid.fixture-' + captures.messages.length + '-' + captures.images.length }] };
    },
  };

  const orderService = new OrderService({ firestoreRepo, catalogRepo, whatsappClient: mockWhatsapp });
  const learningService = new LearningService({ firestoreRepo, catalogRepo });

  return new MessageService({
    router,
    directPriceService,
    agentService,
    catalogRepo,
    firestoreRepo,
    orderService,
    whatsappClient: mockWhatsapp,
    learningService,
  });
}





















test('11. Proteção de markAsRead contra IDs que não iniciam com wamid (prevenção erro 131009)', async () => {
  const service = createTestMessageService();
  await new (require('../src/services/incoming-message.service').IncomingMessageService)(service.firestoreRepo).accept({ phone: '5564999990011', message: 'Oi', messageId: 'local-123456789' });
  const result = await service.handleCustomerMessage({
    phone: '5564999990011',
    message: 'Oi',
    messageId: 'local-123456789',
  });
  assert.ok(result);
});

test('12. Robustez do parser de moedas (US comma e BR dot)', () => {
  assert.strictEqual(parseCurrencyString('R$ 2,900.00'), 2900);
  assert.strictEqual(parseCurrencyString('R$ 3,900.00'), 3900);
  assert.strictEqual(parseCurrencyString('R$ 2.900,00'), 2900);
  assert.strictEqual(parseCurrencyString('R$ 8.00'), 8);
  assert.strictEqual(parseCurrencyString('R$ 8,00'), 8);
  assert.strictEqual(parseCurrencyString('R$ 0.30'), 0.3);
  assert.strictEqual(formatCurrency(2900), 'R$ 2.900,00');
});

test('13. Busca inteligente usando tags cadastradas no Firestore (ex: "três marias")', async () => {
  const service = createTestMessageService();
  const product = service.catalogRepo.findProductByName('tres marias');
  assert.ok(product);
  assert.strictEqual(product.canonicalName, 'Bouganville / Primavera');
});

test('14. Aprendizado Contínuo com Integridade', async () => {
  const service = createTestMessageService();
  const learningService = new LearningService({ firestoreRepo: service.firestoreRepo, catalogRepo: service.catalogRepo });
  await learningService.learnFromCompletedSale({
    purchasedItems: [{ name: 'Palmeira Azul', price: 190.0 }],
    conversationHistory: [{ role: 'user', text: 'voces tem palmeira de bismarck' }],
  });

  const bismarckMatch = service.catalogRepo.findProductByName('palmeira de bismarck');
  assert.ok(bismarckMatch);
  assert.strictEqual(bismarckMatch.canonicalName, 'Palmeira Azul');
});

test('15. Meta App Verification: Validação das páginas de Privacidade e Exclusão de Dados', () => {
  const privacyHtml = renderPrivacyPolicyHtml();
  assert.match(privacyHtml, /LGPD/);
  assert.match(privacyHtml, /Conflora Horta e Viveiro/);
  assert.match(privacyHtml, /edmarjuniob@gmail.com/);

  const dataDeletionHtml = renderDataDeletionHtml();
  assert.match(dataDeletionHtml, /Instruções de Exclusão de Dados/);
  assert.match(dataDeletionHtml, /edmarjuniob@gmail.com/);

  const termsHtml = renderTermsOfServiceHtml();
  assert.match(termsHtml, /Termos de Serviço/);
});



test('17. Firestore Repository: Entrada ágil de estoque e venda balcão', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });

  // 1. O repositório começa vazio; o cenário cadastra seu próprio produto.
  assert.deepStrictEqual(await repo.getAllProducts(), []);
  await repo.saveProduct({
    id: 'stock-test-palm',
    name: 'Palmeira de Teste',
    category: 'Palmeiras',
    price: 100,
    stockQuantity: 5,
  });
  const products = await repo.getAllProducts();
  assert.strictEqual(products.length, 1);
  assert.strictEqual(products[0].id, 'stock-test-palm');

  // 2. Entrada ágil de estoque (+10)
  const prodId = products[0].id;
  const initialStock = products[0].stockQuantity || products[0].estoque || 0;
  const stockResult = await repo.quickAddStock(prodId, 10);
  assert.strictEqual(stockResult.success, true);
  assert.strictEqual(stockResult.newStock, initialStock + 10);

  // 3. Venda manual no balcão
  const manualOrder = await repo.createManualOrder({
    customerName: 'Cliente Balcão Mineiros',
    customerPhone: '5564999998888',
    paymentMethod: 'DINHEIRO',
    items: [{ productId: prodId, name: products[0].name, price: products[0].price, quantity: 2 }],
  });
  assert.ok(manualOrder.id);
  assert.strictEqual(manualOrder.status, 'CONFIRMED');

  // Verifica que o estoque baixou 2 unidades
  const updatedProds = await repo.getAllProducts();
  const updatedProd = updatedProds.find(p => p.id === prodId);
  assert.strictEqual(updatedProd.stockQuantity, initialStock + 10 - 2);

});

test('18. Status Dashboard & Google Auth: Diagnóstico de conexões e autenticação Google', async () => {
  const { SystemStatusService } = require('../src/services/system-status.service');
  const repo = new FirestoreRepository({ isInMemory: true });
  const catalog = new CatalogRepository({ firestoreRepo: repo });
  const statusService = new SystemStatusService({ firestoreRepo: repo, whatsappClient: {} });

  // 1. Diagnóstico completo
  const status = await statusService.getSystemStatus();
  assert.ok(status.whatsapp);
  assert.ok(status.firestore);
  assert.equal('defaultCatalog' in status, false);

  // 2. Teste do webhook
  statusService.recordWebhookHit('5564999351616');
  const waStatus = statusService.checkWhatsAppStatus();
  assert.strictEqual(waStatus.totalReceivedCount, 1);
  assert.strictEqual(waStatus.webhookRoute, '/webhook');

  // 3. Teste Google Auth no backend
  const { createApp } = require('../src/http/app');
  await repo.saveUser({ id: 'staff-vendedor', name: 'Rose', email: 'rose@conflora.com.br', role: 'VENDEDOR', active: true });
  const sentReports = [];
  const whatsappClient = { async sendTextMessage(to, text) { sentReports.push({ to, text }); return { messages: [{ id: 'wamid.report-test' }] }; } };
  const messageService = { firestoreRepo: repo, catalogRepo: catalog, whatsappClient };
  const identities = {
    admin: { uid: 'google-admin', email: 'edmarjuniob@gmail.com', name: 'Edmar Júnio', picture: 'https://example.com/avatar.jpg', email_verified: true, firebase: { sign_in_provider: 'google.com' } },
    customer: { uid: 'google-customer', email: 'cliente@gmail.com', name: 'Maria Silva', email_verified: true, firebase: { sign_in_provider: 'google.com' } },
    staff: { uid: 'google-staff', email: 'rose@conflora.com.br', name: 'Rose', email_verified: true, firebase: { sign_in_provider: 'google.com' } },
    unverified: { email: 'edmarjuniob@gmail.com', email_verified: false, firebase: { sign_in_provider: 'google.com' } },
    password: { email: 'edmarjuniob@gmail.com', email_verified: true, firebase: { sign_in_provider: 'password' } },
  };
  const app = createApp({ messageService, taskQueueClient: {}, verifyGoogleToken: async (token) => {
    if (!identities[token]) { throw new Error('Invalid token'); }
    return identities[token];
  } });

  const server = app.listen(0);
  const port = server.address().port;

  try {
    // Admin login
    const adminRes = await fetch(`http://localhost:${port}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'admin' }),
    });
    const adminData = await adminRes.json();
    assert.strictEqual(adminData.success, true);
    assert.strictEqual(adminData.user.role, 'ADMIN');
    assert.strictEqual(adminData.user.name, 'Edmar Júnio');
    assert.strictEqual(adminData.user.picture, identities.admin.picture);

    const previousOwnerNumber = process.env.OWNER_WHATSAPP_NUMBER;
    process.env.OWNER_WHATSAPP_NUMBER = '5564999351616';
    try {
      const adminCookie = adminRes.headers.get('set-cookie').split(';')[0];
      const reportRes = await fetch(`http://localhost:${port}/api/admin/executive-metrics/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ date: '2026-10-15' }),
      });
      const reportData = await reportRes.json();
      assert.equal(reportRes.status, 200);
      assert.equal(reportData.messagesSent, 1);
      assert.match(sentReports[0].text, /CONFLORA/);
      assert.equal(sentReports[0].to, '5564999351616');

      const staffRes = await fetch(`http://localhost:${port}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'staff' }),
      });
      const staffCookie = staffRes.headers.get('set-cookie').split(';')[0];
      const deniedRes = await fetch(`http://localhost:${port}/api/admin/executive-metrics/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
        body: JSON.stringify({ date: '2026-10-15' }),
      });
      assert.equal(deniedRes.status, 403);
      assert.equal(sentReports.length, 1, 'contas não ADMIN não podem disparar o relatório');
    } finally {
      if (previousOwnerNumber === undefined) { delete process.env.OWNER_WHATSAPP_NUMBER; }
      else { process.env.OWNER_WHATSAPP_NUMBER = previousOwnerNumber; }
    }

    // Customer login (opcional para clientes)
    const custRes = await fetch(`http://localhost:${port}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'customer', email: 'edmarjuniob@gmail.com', name: 'Forged Admin' }),
    });
    const custData = await custRes.json();
    assert.strictEqual(custData.success, true);
    assert.strictEqual(custData.user.role, 'CLIENTE');
    assert.strictEqual(custData.user.name, 'Maria Silva');
    assert.strictEqual(custData.user.email, 'cliente@gmail.com');
    for (const payload of [{ email: 'edmarjuniob@gmail.com' }, { idToken: 'invalid' }, { idToken: 'unverified' }, { idToken: 'password' }]) {
      const response = await fetch(`http://localhost:${port}/api/auth/google`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      assert.strictEqual(response.status, 401);
    }
    identities.admin.name = 'Updated Google Name';
    await fetch(`http://localhost:${port}/api/auth/google`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: 'admin' }),
    });
    assert.strictEqual((await repo.getAllUsers()).find(user => user.id === adminData.user.id).name, 'Updated Google Name');

    // Live inventory endpoint
    const invRes = await fetch(`http://localhost:${port}/api/inventory`);
    const invData = await invRes.json();
    assert.strictEqual(invRes.status, 200);
    assert.ok(Array.isArray(invData.products));
    assert.deepEqual(invData.products, [], 'Base vazia não deve ressuscitar catálogo padrão');
  } finally {
    server.close();
  }
});

