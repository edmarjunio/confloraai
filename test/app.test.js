process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

const { CatalogRepository } = require('../src/catalog/catalog.repository');
const { MessageRouter, INTENTS } = require('../src/router/message.router');
const { DirectPriceService } = require('../src/services/direct-price.service');
const { AgentService } = require('../src/ai/agent.service');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { OrderService } = require('../src/orders/order.service');
const { LearningService } = require('../src/services/learning.service');
const { MessageService } = require('../src/services/message.service');
const { parseCurrencyString, formatCurrency } = require('../src/shared/string.util');
const { renderPrivacyPolicyHtml, renderDataDeletionHtml, renderTermsOfServiceHtml, renderHomeHtml, renderAdminHtml } = require('../src/http/app');

const mockProducts = [
  {
    id: '1',
    name: 'Palmeira Rabo de Raposa',
    category: 'Plantas / Mudas',
    subcategory: 'Palmeiras',
    price: 79.0,
    status: 'ATIVO',
    imageFileId: 'drive-file-rabo-de-raposa-01',
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
    imageFileId: 'drive-file-rabo-de-raposa-02',
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
  const catalogRepo = new CatalogRepository({ spreadsheetId: 'mock-id', mockData: mockProducts, firestoreRepo });
  const router = new MessageRouter(catalogRepo);
  const directPriceService = new DirectPriceService();
  const agentService = new AgentService({ aiClient: aiMock });

  const mockWhatsapp = {
    async sendTextMessage(to, text) {
      captures.messages.push({ to, text });
      return { success: true };
    },
    async sendImageMessage(to, url, caption) {
      captures.images.push({ to, url, caption });
      return { success: true };
    },
    async markAsRead(id) {
      if (!id || !id.startsWith('wamid.')) {
        return { mock: true, skippedNonMetaId: true };
      }
      return { success: true };
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

test('1. Consulta direta de valor: Palmeira Rabo de Raposa (DIRECT_PRICE)', async () => {
  const service = createTestMessageService();
  const result = await service.handleCustomerMessage({
    phone: '5564999990001',
    message: 'qual valor da palmeira rabo de raposa?',
    messageId: `wamid.001-${Date.now()}`,
  });

  assert.strictEqual(result.intent, INTENTS.DIRECT_PRICE);
  assert.match(result.reply, /Palmeira Rabo de Raposa/i);
  assert.match(result.reply, /79,00/);
  assert.match(result.reply, /195,00/);
});

test('2. Consulta composta: "Vocês tem mini cabra??" deve casar DIRECT_PRICE com Macho e Fêmea', async () => {
  const service = createTestMessageService();
  const result = await service.handleCustomerMessage({
    phone: '5564999990002',
    message: 'Vocês tem mini cabra??',
    messageId: `wamid.002-${Date.now()}`,
  });

  assert.strictEqual(result.intent, INTENTS.DIRECT_PRICE);
  assert.match(result.reply, /Mini Cabra/i);
  assert.match(result.reply, /2\.900,00/);
  assert.match(result.reply, /3\.900,00/);
  assert.doesNotMatch(result.reply, /não trabalhamos/i);
  assert.doesNotMatch(result.reply, /plantar em vaso/i);
});

test('3. Pluralização: "Vocês tem mini cabras?" também casa DIRECT_PRICE', async () => {
  const service = createTestMessageService();
  const result = await service.handleCustomerMessage({
    phone: '5564999990003',
    message: 'Vocês tem mini cabras?',
    messageId: `wamid.003-${Date.now()}`,
  });

  assert.strictEqual(result.intent, INTENTS.DIRECT_PRICE);
  assert.match(result.reply, /Mini Cabra/i);
  assert.match(result.reply, /2\.900,00/);
  assert.match(result.reply, /3\.900,00/);
});

test('4. Pergunta aberta de categoria: "Vocês tem palmeiras?" ativa CONSULTATIVE_SALES', async () => {
  let aiPromptCalled = '';
  const aiMock = {
    models: {
      async generateContent(req) {
        aiPromptCalled = req.config?.systemInstruction || '';
        return {
          text: 'Olá! Temos sim, trabalhamos com a Palmeira Rabo de Raposa, Palmeira Azul e Areca Bambu. Você prefere para plantar em vaso ou direto no jardim?',
        };
      },
    },
  };

  const service = createTestMessageService(aiMock);
  const result = await service.handleCustomerMessage({
    phone: '5564999990004',
    message: 'Vocês tem palmeiras?',
    messageId: `wamid.004-${Date.now()}`,
  });

  assert.strictEqual(result.intent, INTENTS.CONSULTATIVE_SALES);
  assert.match(result.reply, /Palmeira Rabo de Raposa/);
  assert.match(aiPromptCalled, /Palmeira Rabo de Raposa/);
});

test('5. Confirmação de tamanho quando produto tem múltiplos preços e sem histórico', async () => {
  const service = createTestMessageService();
  const result = await service.handleCustomerMessage({
    phone: '5564999990005',
    message: 'Manda pra mim 3 alface crespa',
    messageId: `wamid.005-${Date.now()}`,
  });

  assert.strictEqual(result.intent, INTENTS.ASK_SIZE_CONFIRMATION);
  assert.match(result.reply, /ALFACE CRESPA/i);
  assert.match(result.reply, /8,00/);
  assert.match(result.reply, /14,00/);
  assert.match(result.reply, /20,00/);
  assert.match(result.reply, /Qual tamanho você prefere/i);
});

test('6. Cliente VIP com Histórico ("O de sempre") corta conversa e propõe recibo pronto', async () => {
  const service = createTestMessageService();
  const phone = '5564999990006';

  // Salva histórico de compra prévia
  await service.firestoreRepo.saveCustomerProfile(phone, {
    name: 'Carlos Cliente',
    deliveryAddress: 'Avenida Alessandro Marchió, 162, Centro',
    paymentMethod: 'PIX',
    preferredItems: {
      'alface crespa': 8.0,
    },
  });

  const result = await service.handleCustomerMessage({
    phone,
    message: 'Manda pra mim 3 alface crespa',
    messageId: `wamid.006-${Date.now()}`,
  });

  assert.strictEqual(result.intent, INTENTS.PLACE_ORDER);
  assert.match(result.reply, /Claro! Vai ser o de sempre\?/);
  assert.match(result.reply, /3x ALFACE CRESPA \(R\$ 8,00 un\) = R\$ 24,00/i);
  assert.match(result.reply, /Valor total:.*?24,00/);
  assert.match(result.reply, /Avenida Alessandro Marchió, 162, Centro/);
  assert.match(result.reply, /No \*PIX\* né\?/);
});

test('7. Pedido múltiplo com preços definidos (Exemplo 1 - Recibo com subtotais)', async () => {
  const service = createTestMessageService();
  const phone = '5564999990007';

  const result = await service.handleCustomerMessage({
    phone,
    message: 'Manda pra mim 3 alface cabeça de 8, 3 rucula e 5 cebolinha',
    messageId: `wamid.007-${Date.now()}`,
  });

  assert.strictEqual(result.intent, INTENTS.PLACE_ORDER);
  assert.match(result.reply, /Certo! Já anotei o seu pedido:/);
  assert.match(result.reply, /📋 \*Resumo do Pedido:\*/);
  assert.match(result.reply, /3x ALFACE CABEÇA \/ AMERICANA \(R\$ 8,00 un\) = R\$ 24,00/i);
  assert.match(result.reply, /3x RÚCULA \(R\$ 8,00 un\) = R\$ 24,00/i);
  assert.match(result.reply, /5x CEBOLINHA \(R\$ 8,00 un\) = R\$ 40,00/i);
  assert.match(result.reply, /💰 \*Valor total:\* R\$ 88,00/);
  assert.match(result.reply, /Poderia me confirmar o pedido e mandar o endereço pra gente entregar\?/);
  assert.match(result.reply, /Qual seria a forma de pagamento\?/);
});

test('8. Alteração de forma de pagamento ("Hoje vai ser no débito") e reenvio de recibo atualizado', async () => {
  const service = createTestMessageService();
  const phone = '5564999990008';

  // 1. Cria pedido inicial
  await service.handleCustomerMessage({
    phone,
    message: 'Manda pra mim 3 alface cabeça de 8, 3 rucula e 5 cebolinha',
    messageId: `wamid.008a-${Date.now()}`,
  });

  // 2. Cliente altera a forma de pagamento
  const updateResult = await service.handleCustomerMessage({
    phone,
    message: 'Hoje vai ser no débito',
    messageId: `wamid.008b-${Date.now()}`,
  });

  assert.strictEqual(updateResult.intent, INTENTS.UPDATE_ORDER_DETAILS);
  assert.match(updateResult.reply, /Perfeito! Já atualizei o seu pedido:/);
  assert.match(updateResult.reply, /💳 \*Forma de pagamento:\* Cartão de Débito/);
  assert.match(updateResult.reply, /💰 \*Valor total:\* R\$ 88,00/);
  assert.match(updateResult.reply, /Poderia me confirmar para finalizarmos\?/);
});

test('9. Confirmação do pedido: Envio ao dono e fechamento com cliente', async () => {
  const captures = { messages: [] };
  const service = createTestMessageService(null, captures);
  const phone = '5564999990009';

  // 1. Cria pedido
  await service.handleCustomerMessage({
    phone,
    message: 'Manda pra mim 3 alface cabeça de 8, 3 rucula e 5 cebolinha',
    messageId: `wamid.009a-${Date.now()}`,
  });

  // 2. Define endereço
  await service.handleCustomerMessage({
    phone,
    message: 'entregar em: Rua 12, Quadra 10, Lote 5, Centro',
    messageId: `wamid.009b-${Date.now()}`,
  });

  // 3. Cliente confirma
  const confirmResult = await service.handleCustomerMessage({
    phone,
    message: 'Pode confirmar!',
    messageId: `wamid.009c-${Date.now()}`,
  });

  assert.strictEqual(confirmResult.intent, INTENTS.ORDER_CONFIRMATION);
  assert.match(confirmResult.reply, /✅ \*Pedido Confirmado com Sucesso!\*/);
  assert.match(confirmResult.reply, /R\$ 88,00/);
  assert.match(confirmResult.reply, /Chave PIX/);

  // Valida que o perfil foi salvo para compras futuras
  const profile = await service.firestoreRepo.getCustomerProfile(phone);
  assert.ok(profile);
  assert.strictEqual(profile.deliveryAddress, 'Rua 12, Quadra 10, Lote 5, Centro');
});

test('10. Envio de fotos do Google Drive com legenda identificando nome e valores', async () => {
  const captures = { images: [] };
  const service = createTestMessageService(null, captures);

  const result = await service.handleCustomerMessage({
    phone: '5564999990010',
    message: 'pode me mandar foto da palmeira rabo de raposa?',
    messageId: `wamid.010-${Date.now()}`,
  });

  assert.strictEqual(result.intent, INTENTS.REQUEST_PHOTOS);
  assert.ok(captures.images.length >= 1);
  assert.match(captures.images[0].caption, /Palmeira Rabo de Raposa/);
  assert.match(captures.images[0].caption, /R\$ 79,00 e R\$ 195,00/);
});

test('11. Proteção de markAsRead contra IDs que não iniciam com wamid (prevenção erro 131009)', async () => {
  const service = createTestMessageService();
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

test('13. Busca inteligente usando TAGS_IA da planilha (ex: "três marias")', async () => {
  const service = createTestMessageService();
  const product = service.catalogRepo.findProductByName('tres marias');
  assert.ok(product);
  assert.strictEqual(product.canonicalName, 'Bouganville / Primavera');
});

test('14. Aprendizado Contínuo com Integridade', async () => {
  const service = createTestMessageService();
  await service.learningService.learnFromCompletedSale({
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

test('16. Cardápio Digital & Painel Admin: Renderização e elementos essenciais', () => {
  const homeHtml = renderHomeHtml();
  assert.match(homeHtml, /Conflora Horta e Viveiro/);
  assert.match(homeHtml, /Cardápio Digital/);
  assert.match(homeHtml, /galleryModal/);
  assert.match(homeHtml, /setOrderType/);

  const adminHtml = renderAdminHtml();
  assert.match(adminHtml, /Painel Operacional Conflora/);
  assert.match(adminHtml, /Caixa & Pedidos/);
  assert.match(adminHtml, /Entrada Rápida de Estoque/);
  assert.match(adminHtml, /Cadastro de Produtos/);
  assert.match(adminHtml, /Importar Planilhas/);
});

test('17. Firestore Repository: Entrada ágil de estoque, venda balcão e importador de planilha', async () => {
  const repo = new FirestoreRepository({ isInMemory: true });

  // 1. Produtos iniciais carregados
  const products = await repo.getAllProducts();
  assert.ok(products.length >= 10);

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
    paymentMethod: 'PIX',
    items: [{ productId: prodId, name: products[0].name, price: products[0].price, quantity: 2 }],
  });
  assert.ok(manualOrder.id);
  assert.strictEqual(manualOrder.status, 'CONFIRMED');

  // Verifica que o estoque baixou 2 unidades
  const updatedProds = await repo.getAllProducts();
  const updatedProd = updatedProds.find(p => p.id === prodId);
  assert.strictEqual(updatedProd.stockQuantity, initialStock + 10 - 2);

  // 4. Importação de lote de planilha
  const importResult = await repo.importSpreadsheetData({
    type: 'products',
    records: [
      { id: 'teste-imp-1', name: 'Palmeira Imperial Gigante', category: 'Palmeiras', price: 'R$ 350,00', stockQuantity: 5 },
      { id: 'teste-imp-2', name: 'Muda de Jabuticaba Híbrida', category: 'Frutíferas', price: 120, stockQuantity: 8 },
    ],
  });
  assert.strictEqual(importResult.success, true);
  assert.strictEqual(importResult.count, 2);

  const afterImport = await repo.getAllProducts();
  const importedItem = afterImport.find(p => p.id === 'teste-imp-1');
  assert.ok(importedItem);
  assert.strictEqual(importedItem.name, 'Palmeira Imperial Gigante');
});

test('18. Status Dashboard & Google Auth: Diagnóstico de conexões e autenticação Google', async () => {
  const { SystemStatusService } = require('../src/services/system-status.service');
  const repo = new FirestoreRepository({ isInMemory: true });
  const catalog = new CatalogRepository({ firestoreRepo: repo });
  const statusService = new SystemStatusService({ catalogRepo: catalog, firestoreRepo: repo, whatsappClient: {} });

  // 1. Diagnóstico completo
  const status = await statusService.getSystemStatus();
  assert.ok(status.googleSheets);
  assert.ok(status.whatsapp);
  assert.ok(status.firestore);
  assert.ok(status.defaultCatalog);
  assert.strictEqual(status.defaultCatalog.totalItems, 111);
  assert.ok(['ONLINE', 'FALLBACK_OFFICIAL'].includes(status.googleSheets.status));

  // 2. Teste do webhook
  statusService.recordWebhookHit('5564999351616');
  const waStatus = statusService.checkWhatsAppStatus();
  assert.strictEqual(waStatus.totalReceivedCount, 1);
  assert.strictEqual(waStatus.webhookRoute, '/webhook');

  // 3. Teste Google Auth no backend
  const { createApp } = require('../src/http/app');
  const messageService = { firestoreRepo: repo, catalogRepo: catalog };
  const app = createApp({ messageService, taskQueueClient: {} });

  const server = app.listen(0);
  const port = server.address().port;

  try {
    // Admin login
    const adminRes = await fetch(`http://localhost:${port}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'edmarjuniob@gmail.com', name: 'Edmar Júnio' }),
    });
    const adminData = await adminRes.json();
    assert.strictEqual(adminData.success, true);
    assert.strictEqual(adminData.user.role, 'ADMIN');

    // Customer login (opcional para clientes)
    const custRes = await fetch(`http://localhost:${port}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'cliente@gmail.com', name: 'Maria Silva' }),
    });
    const custData = await custRes.json();
    assert.strictEqual(custData.success, true);
    assert.strictEqual(custData.user.role, 'CLIENTE');

    // Live inventory endpoint
    const invRes = await fetch(`http://localhost:${port}/api/inventory`);
    const invData = await invRes.json();
    assert.strictEqual(invRes.status, 200);
    assert.ok(Array.isArray(invData.products));
    assert.ok(invData.products.length >= 100);
  } finally {
    server.close();
  }
});
