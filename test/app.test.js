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
const { renderPrivacyPolicyHtml, renderDataDeletionHtml, renderTermsOfServiceHtml } = require('../src/http/app');

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
];

function createTestMessageService(aiMock = null, imagesSentCaptures = []) {
  const firestoreRepo = new FirestoreRepository({ isInMemory: true });
  const catalogRepo = new CatalogRepository({ spreadsheetId: 'mock-id', mockData: mockProducts, firestoreRepo });
  const router = new MessageRouter(catalogRepo);
  const directPriceService = new DirectPriceService();
  const agentService = new AgentService({ aiClient: aiMock });
  const orderService = new OrderService({ firestoreRepo, catalogRepo });
  const learningService = new LearningService({ firestoreRepo, catalogRepo });

  const mockWhatsapp = {
    async sendTextMessage() { return { success: true }; },
    async sendImageMessage(to, url, caption) {
      imagesSentCaptures.push({ to, url, caption });
      return { success: true };
    },
    async markAsRead() { return { success: true }; },
  };

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

test('1. Consulta direta de valor: Palmeira Rabo de Raposa (sem template bot)', async () => {
  const service = createTestMessageService();
  const result = await service.handleCustomerMessage({
    phone: '5564999990001',
    message: 'qual valor da palmeira rabo de raposa?',
    messageId: `msg-001-${Date.now()}-${Math.random()}`,
  });

  assert.strictEqual(result.intent, INTENTS.DIRECT_PRICE);
  assert.match(result.reply, /Palmeira Rabo de Raposa/i);
  assert.match(result.reply, /79,00/);
  assert.match(result.reply, /195,00/);
});

test('2. Agente Consultivo: Pergunta aberta "Vocês tem palmeiras?" (apenas palmeiras reais)', async () => {
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
    phone: '5564999990002',
    message: 'Vocês tem palmeiras?',
    messageId: `msg-002-${Date.now()}-${Math.random()}`,
  });

  assert.strictEqual(result.intent, INTENTS.CONSULTATIVE_SALES);
  assert.match(result.reply, /Palmeira Rabo de Raposa/);
  assert.match(result.reply, /vaso ou direto no jardim/);
  // Garante que o prompt recebeu palmeiras reais e nenhuma categoria estranha
  assert.match(aiPromptCalled, /Palmeira Rabo de Raposa/);
  assert.doesNotMatch(aiPromptCalled, /porquinho da india/i);
});

test('3. Envio de fotos do Google Drive com legenda identificando nome e valores', async () => {
  const imagesSent = [];
  const service = createTestMessageService(null, imagesSent);

  const result = await service.handleCustomerMessage({
    phone: '5564999990003',
    message: 'pode me mandar foto da palmeira rabo de raposa?',
    messageId: `msg-photo-${Date.now()}-${Math.random()}`,
  });

  assert.strictEqual(result.intent, INTENTS.REQUEST_PHOTOS);
  assert.ok(imagesSent.length >= 1, 'Deveria ter enviado pelo menos 1 imagem');
  assert.match(imagesSent[0].url, /drive\.google\.com\/uc\?export=view&id=drive-file-rabo-de-raposa/);
  assert.match(imagesSent[0].caption, /Palmeira Rabo de Raposa/);
  assert.match(imagesSent[0].caption, /R\$ 79,00 e R\$ 195,00/);
});

test('4. Busca inteligente usando TAGS_IA da planilha (ex: "três marias")', async () => {
  const service = createTestMessageService();

  const product = service.catalogRepo.findProductByName('tres marias');
  assert.ok(product, 'Deveria localizar o produto através da TAG_IA "tres marias"');
  assert.strictEqual(product.canonicalName, 'Bouganville / Primavera');
  assert.strictEqual(product.descriptionAi, 'Trepadeira muito florida de sol pleno.');
});

test('5. Aprendizado Contínuo com Integridade: Proteção contra produtos múltiplos', async () => {
  const service = createTestMessageService();
  const phone = '5564999990005';

  // Cenário de compra múltipla: NÃO deve associar tags a produtos errados
  await service.learningService.learnFromCompletedSale({
    purchasedItems: [
      { name: 'Palmeira Azul', price: 190.0 },
      { name: 'Areca Bambu', price: 79.0 },
    ],
    conversationHistory: [
      { role: 'user', text: 'quero aquela planta azulada para jardim de inverno' },
    ],
  });

  // Palmeira Azul NÃO deve ter sido contaminada com termo genérico
  const azul = service.catalogRepo.findProductByName('Palmeira Azul');
  assert.ok(!azul.tags.has('azulada para jardim de inverno'));

  // Cenário de compra única com termo específico: APRENDE com segurança
  await service.learningService.learnFromCompletedSale({
    purchasedItems: [
      { name: 'Palmeira Azul', price: 190.0 },
    ],
    conversationHistory: [
      { role: 'user', text: 'voces tem palmeira de bismarck' },
    ],
  });

  const bismarckMatch = service.catalogRepo.findProductByName('palmeira de bismarck');
  assert.ok(bismarckMatch, 'Deveria assimilar o termo novo "palmeira de bismarck" à Palmeira Azul');
  assert.strictEqual(bismarckMatch.canonicalName, 'Palmeira Azul');
});

test('6. Meta App Verification: Validação das páginas de Privacidade e Exclusão de Dados', () => {
  const privacyHtml = renderPrivacyPolicyHtml();
  assert.match(privacyHtml, /LGPD/);
  assert.match(privacyHtml, /Conflora Horta e Viveiro/);
  assert.match(privacyHtml, /edmarjuniob@gmail.com/);

  const dataDeletionHtml = renderDataDeletionHtml();
  assert.match(dataDeletionHtml, /Instruções de Exclusão de Dados/);
  assert.match(dataDeletionHtml, /edmarjuniob@gmail.com/);
  assert.match(dataDeletionHtml, /48 horas/);

  const termsHtml = renderTermsOfServiceHtml();
  assert.match(termsHtml, /Termos de Serviço/);
});

test('7. Consultoria de Palmeiras: Sol vs Sombra (Jardim ou Dentro de Casa)', async () => {
  let promptPassed = '';
  const aiMock = {
    models: {
      async generateContent(req) {
        promptPassed = req.config?.systemInstruction || '';
        return { text: 'Olá! Temos ótimas opções disponíveis na nossa loja! Você quer pra colocar no jardim (sol pleno) ou dentro de casa?' };
      }
    }
  };

  const service = createTestMessageService(aiMock);
  const result = await service.handleCustomerMessage({
    phone: '5564999990007',
    message: 'quero uma palmeira',
    messageId: 'msg-palmeira-' + Date.now(),
  });

  assert.strictEqual(result.domain, 'PLANTAS');
  assert.match(promptPassed, /Você quer pra colocar no jardim ou dentro de casa/);
  assert.match(promptPassed, /Temos algumas opções disponíveis na nossa loja/);
  assert.match(result.reply, /jardim/i);
});

test('8. Consultoria de Pets: Porquinho da Índia (Raças e Sexo sem cruzamento de plantas)', async () => {
  let promptPassed = '';
  const aiMock = {
    models: {
      async generateContent(req) {
        promptPassed = req.config?.systemInstruction || '';
        return { text: 'Olá! Temos sim, trabalhamos com o porquinho da índia abissínio, peruano e comum, tanto machos quanto fêmeas. Você procura alguma raça específica?' };
      }
    }
  };

  const service = createTestMessageService(aiMock);
  const result = await service.handleCustomerMessage({
    phone: '5564999990008',
    message: 'vocês têm porquinho da índia?',
    messageId: 'msg-pet-' + Date.now(),
  });

  assert.strictEqual(result.domain, 'PETS');
  assert.match(promptPassed, /NUNCA pergunte sobre jardim, vaso, sol ou sombra/);
  assert.match(promptPassed, /Abissínio/);
  assert.doesNotMatch(promptPassed, /sol pleno/);
});
