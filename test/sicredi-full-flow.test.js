process.env.NODE_ENV = 'test';
process.env.PIX_MODE = 'SICREDI';
process.env.OWNER_WHATSAPP_NUMBER = '5564999994321';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { FirestoreRepository } = require('./helpers/repository-fixture');
const { SicrediPixClient } = require('../src/integrations/sicredi-pix.client');
const { createApp } = require('../src/http/app');

function createTestEnvironment() {
  const db = require('./helpers/metered-firestore').meteredFirestore();
  const firestoreRepo = new FirestoreRepository({ firestoreInstance: db });
  db.data.set('store_settings/storefront', firestoreRepo.storefrontSettings);
  for (const user of [{id:'usr-edmar',role:'ADMIN',pin:'1234'}, {id:'usr-caixa1',role:'CAIXA',pin:'0000'}]) db.data.set('users/' + user.id, {...user,active:true});

  // Cadastra produto real no banco (Firestore em memória) com preço R$ 45,00 e estoque 10
  db.data.set('products/muda-ipe', {
    id: 'muda-ipe',
    name: 'Muda de Ipê Amarelo',
    price: 45.0,
    stockQuantity: 10,
    reservedQuantity: 0,
    unit: 'UN',
    status: 'ATIVO',
    isAvailable: true,
  });

  const whatsappMessages = [];
  const whatsappClient = {
    sendTextMessage: async (phone, text) => {
      whatsappMessages.push({ type: 'text', phone, text });
      return { messages: [{ id: `wamid.txt.${whatsappMessages.length}` }] };
    },
    sendImageBuffer: async (phone, buffer, caption) => {
      whatsappMessages.push({
        type: 'image',
        phone,
        caption,
        sizeBytes: buffer.length,
      });
      return { messages: [{ id: `wamid.img.${whatsappMessages.length}` }] };
    },
  };

  const sicrediApiCalls = [];
  const pixKey = '52998224725';

  // Instancia o SicrediPixClient real interceptando apenas o transporte HTTPS mTLS
  const sicrediClient = new SicrediPixClient({
    clientId: 'client-id-conflora',
    clientSecret: 'client-secret-conflora',
    certificate: '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----',
    privateKey: '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----',
    pixKey,
    beneficiario: 'Conflora Horta e Viveiro',
    cidade: 'Mineiros',
    request: async (url, options) => {
      const parsedBody = options.body && options.headers?.['Content-Type'] === 'application/json'
        ? JSON.parse(options.body)
        : options.body;
      sicrediApiCalls.push({ url, method: options.method, body: parsedBody, headers: options.headers });

      // 1. Endpoint OAuth2 Token
      if (url.includes('/oauth/token')) {
        return { access_token: 'sicredi-mtls-oauth-token', expires_in: 3600 };
      }

      // 2. Endpoint de Criação de Cobrança Imediata (PUT /cob/:txid)
      if (options.method === 'PUT' && url.includes('/cob/')) {
        const txid = decodeURIComponent(url.split('/cob/')[1]);
        return {
          txid,
          chave: pixKey,
          status: 'ATIVA',
          calendario: { criacao: new Date().toISOString(), expiracao: parsedBody.calendario.expiracao },
          valor: {
            original: parsedBody.valor.original,
            modalidadeAlteracao: parsedBody.valor.modalidadeAlteracao,
          },
          solicitacaoPagador: parsedBody.solicitacaoPagador,
          pixCopiaECola: `00020101021226850014br.gov.bcb.pix2563pix.sicredi.com.br/qr/v2/${txid}5204000053039865405${parsedBody.valor.original}5802BR5924Conflora Horta e Viveiro6008Mineiros6304ABCD`,
        };
      }

      // 3. Endpoint de Consulta de PIX Recebido (GET /pix/:endToEndId)
      if (options.method === 'GET' && url.includes('/pix/')) {
        const endToEndId = decodeURIComponent(url.split('/pix/')[1]);
        const lastCob = sicrediApiCalls.find((c) => c.method === 'PUT' && c.url.includes('/cob/'));
        const txid = lastCob ? decodeURIComponent(lastCob.url.split('/cob/')[1]) : '';
        return {
          endToEndId,
          txid,
          valor: lastCob ? lastCob.body.valor.original : '90.00',
          chave: pixKey,
          horario: new Date().toISOString(),
          devolucoes: [],
        };
      }

      throw new Error(`Rota Sicredi não esperada no teste: ${options.method} ${url}`);
    },
  });

  const taskQueueClient = {
    enqueuePixExpiration: async (orderId, ttlSeconds) => ({ orderId, ttlSeconds }),
  };

  const app = createApp({
    messageService: { firestoreRepo, whatsappClient },
    taskQueueClient,
    sicrediClient,
  });

  return { firestoreRepo, whatsappClient, whatsappMessages, sicrediClient, sicrediApiCalls, app };
}

test('Fluxo Completo PIX Sicredi: 1) QR Code com valor travado no backend -> 2) Recepção de Webhook -> 3) Atualização de status e estoque no Firebase', async (t) => {
  const previousSecret = process.env.SICREDI_WEBHOOK_SECRET;
  const webhookSecret = 'segredo-webhook-sicredi-conflora-2026-valido-32chars';
  process.env.SICREDI_WEBHOOK_SECRET = webhookSecret;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.SICREDI_WEBHOOK_SECRET;
    else process.env.SICREDI_WEBHOOK_SECRET = previousSecret;
  });

  const { firestoreRepo, whatsappMessages, sicrediApiCalls, app } = createTestEnvironment();
  const server = app.listen(0);
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // =========================================================================
  // ETAPA 1: Geração do Pedido e QR Code com Valor Travado no Backend
  // =========================================================================
  // Tentativa de envio com preço adulterado no payload (R$ 1,00 em vez de R$ 45,00)
  // O backend deve ignorar o preço do cliente e travar 2x R$ 45,00 = R$ 90,00.
  const checkoutRes = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `idem-${randomUUID()}`,
    },
    body: JSON.stringify({
      customerName: 'Maria Oliveira',
      customerPhone: '64999112233',
      orderType: 'PICKUP',
      paymentMethod: 'PIX',
      items: [
        { productId: 'muda-ipe', quantity: 2, price: 1.0 },
      ],
    }),
  });

  assert.equal(checkoutRes.status, 200, 'O pedido deve ser criado com sucesso');
  const checkoutBody = await checkoutRes.json();
  assert.equal(checkoutBody.success, true);

  const createdOrder = checkoutBody.order;
  assert.equal(createdOrder.total, 90.0, 'O valor deve ser calculado e travado pelo backend (2x R$ 45,00 = R$ 90,00)');
  assert.equal(createdOrder.status, 'AWAITING_PIX', 'Status inicial deve ser AWAITING_PIX');
  assert.equal(createdOrder.paymentStatus, 'PENDING', 'Status de pagamento inicial deve ser PENDING');
  assert.equal(createdOrder.pixMode, 'SICREDI');
  assert.ok(createdOrder.pixData?.txid, 'Deve conter um txid gerado para o Sicredi');
  assert.equal(createdOrder.pixData?.mode, 'API_SICREDI_FIXED_AMOUNT', 'Modalidade deve ser valor fixo na API Sicredi');
  assert.match(createdOrder.pixData?.qrCodeBase64, /^data:image\/png;base64,/, 'Deve retornar QR Code em Base64');
  assert.ok(createdOrder.pixData?.pixCopiaECola.includes('540590.00'), 'Pix Copia e Cola deve conter o valor travado de 90.00');

  // Verifica chamada enviada ao Sicredi (PUT /cob/:txid)
  const cobCall = sicrediApiCalls.find((c) => c.method === 'PUT' && c.url.includes('/cob/'));
  assert.ok(cobCall, 'Deve ter chamado PUT /cob/:txid na API do Sicredi');
  assert.equal(cobCall.body.valor.original, '90.00', 'Valor enviado ao Sicredi deve ser exatamente 90.00');
  assert.equal(cobCall.body.valor.modalidadeAlteracao, 0, 'modalidadeAlteracao deve ser 0 (impede o pagador de alterar o valor)');

  // Verifica estado no Firebase (Firestore) antes do Webhook: estoque reservado, não baixado em definitivo
  const productBeforeWebhook = await firestoreRepo.getProductById('muda-ipe');
  assert.equal(productBeforeWebhook.stockQuantity, 10, 'Estoque físico permanece 10 enquanto aguarda pagamento');
  assert.equal(productBeforeWebhook.reservedQuantity, 2, '2 unidades devem estar reservadas no Firestore');

  const storedOrderBefore = await firestoreRepo.getOrderById(createdOrder.id);
  assert.equal(storedOrderBefore.status, 'AWAITING_PIX');
  assert.equal(storedOrderBefore.paymentStatus, 'PENDING');

  // =========================================================================
  // ETAPA 2: Recepção do Payload via Webhook do Sicredi
  // =========================================================================
  const txid = createdOrder.pixData.txid;
  const endToEndId = 'E' + '9'.repeat(31);

  // 2.1 Teste de segurança: requisição sem segredo/certificado deve ser bloqueada com 401
  const unauthorizedWebhook = await fetch(`${baseUrl}/webhooks/sicredi-pix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pix: [{ txid, endToEndId }] }),
  });
  assert.equal(unauthorizedWebhook.status, 401, 'Webhook sem credencial válida deve retornar HTTP 401');

  // 2.2 Disparo oficial autenticado do Webhook do Sicredi
  const validWebhook = await fetch(`${baseUrl}/webhooks/sicredi-pix/${webhookSecret}/pix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pix: [
        {
          endToEndId,
          txid,
          valor: '90.00',
          horario: new Date().toISOString(),
        },
      ],
    }),
  });
  assert.equal(validWebhook.status, 200, 'Webhook autenticado deve responder HTTP 200');

  // Confirma que o backend fez a dupla conferência ativa no Sicredi (GET /pix/:endToEndId)
  const pixCheckCall = sicrediApiCalls.find((c) => c.method === 'GET' && c.url.includes(`/pix/${endToEndId}`));
  assert.ok(pixCheckCall, 'Backend deve consultar GET /pix/:endToEndId no Sicredi antes de aprovar');

  // =========================================================================
  // ETAPA 3: Verificação da Atualização no Firebase (Firestore)
  // =========================================================================
  const updatedOrder = await firestoreRepo.getOrderById(createdOrder.id);
  assert.equal(updatedOrder.status, 'CONFIRMED', 'Status do pedido no Firestore deve ser atualizado para CONFIRMED');
  assert.equal(updatedOrder.paymentStatus, 'APPROVED', 'paymentStatus no Firestore deve ser atualizado para APPROVED');
  assert.equal(updatedOrder.verifiedVia, 'SICREDI_PIX_WEBHOOK', 'Origem da verificação deve ser SICREDI_PIX_WEBHOOK');
  assert.equal(updatedOrder.paymentTransactionId, endToEndId, 'Deve gravar o endToEndId da transação');
  assert.ok(updatedOrder.paidAt, 'Deve preencher data/hora de pagamento (paidAt)');
  assert.ok(updatedOrder.completedAt, 'Deve preencher data/hora de conclusão (completedAt)');

  // Verifica que o evento do webhook ficou registrado como DONE no Firestore
  const eventDoc = await app.locals.pdv.store.read('pdv_pix_events', `${txid}-${endToEndId}`);
  assert.equal(eventDoc?.status, 'DONE', 'Evento do Webhook deve ser marcado como DONE na coleção pdv_pix_events');

  // Verifica baixa definitiva do estoque e liberação da reserva no Firestore
  const productAfterWebhook = await firestoreRepo.getProductById('muda-ipe');
  assert.equal(productAfterWebhook.stockQuantity, 8, 'Estoque físico deve cair de 10 para 8 após confirmação do PIX');
  assert.equal(productAfterWebhook.reservedQuantity, 0, 'Reserva de estoque deve ser zerada após baixa definitiva');

  // Verifica idempotência: se o Sicredi reenviar o mesmo Webhook, nada é duplicado
  const duplicateWebhook = await fetch(`${baseUrl}/webhooks/sicredi-pix/${webhookSecret}/pix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pix: [{ endToEndId, txid, valor: '90.00' }] }),
  });
  assert.equal(duplicateWebhook.status, 200);
  assert.equal((await firestoreRepo.getProductById('muda-ipe')).stockQuantity, 8, 'Reenvio de webhook não pode baixar estoque duas vezes');

  // Verifica envio de notificações WhatsApp (QR Code na criação + Comprovante de PIX aprovado após Webhook)
  assert.ok(whatsappMessages.some((m) => m.type === 'image' && m.caption.includes(createdOrder.pixData.pixCopiaECola)), 'Deve ter enviado a imagem do QR Code PIX');
  assert.ok(whatsappMessages.some((m) => m.type === 'text' && /PIX CONFIRMADO|PAGAMENTO CONFIRMADO/i.test(m.text)), 'Deve ter enviado confirmação de pagamento PIX no WhatsApp');
});

test('Endpoint de Simulação Admin (POST /api/admin/sicredi-pix/simulate) valida as 3 etapas em sandbox isolado', async (t) => {
  const { firestoreRepo, app } = createTestEnvironment();
  await firestoreRepo.saveUser({
    id: 'admin-sim',
    name: 'Admin Conflora',
    email: 'admin@conflora.test',
    role: 'ADMIN',
    pin: '9999',
    active: true,
  });

  const server = app.listen(0);
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Autentica como ADMIN
  const loginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'admin-sim', pin: '9999' }),
  });
  assert.equal(loginRes.status, 200);
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  // Executa a simulação completa do fluxo PIX Sicredi
  const simRes = await fetch(`${baseUrl}/api/admin/sicredi-pix/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ productName: 'Palmeira Imperial', unitPrice: 60, quantity: 3 }),
  });
  assert.equal(simRes.status, 200);
  const report = await simRes.json();

  assert.equal(report.success, true);
  assert.equal(report.isolatedSandbox, true);

  // Etapa 1: QR Code com valor travado
  assert.equal(report.steps.step1_qrCodeGeneration.lockedAmount, 180);
  assert.equal(report.steps.step1_qrCodeGeneration.modalidadeAlteracao, 0);
  assert.equal(report.steps.step1_qrCodeGeneration.hasQrCodeBase64, true);
  assert.equal(report.steps.step1_qrCodeGeneration.statusBeforeWebhook, 'AWAITING_PIX');
  assert.equal(report.steps.step1_qrCodeGeneration.stockBeforeWebhook.reservedQuantity, 3);

  // Etapa 2: Recepção do Webhook e conferência bancária
  assert.equal(report.steps.step2_webhookReception.bankCheckPerformed, true);
  assert.equal(report.steps.step2_webhookReception.eventStatus, 'DONE');

  // Etapa 3: Atualização no Firebase
  assert.equal(report.steps.step3_firebaseUpdate.statusAfterWebhook, 'CONFIRMED');
  assert.equal(report.steps.step3_firebaseUpdate.paymentStatusAfterWebhook, 'APPROVED');
  assert.equal(report.steps.step3_firebaseUpdate.verifiedVia, 'SICREDI_PIX_WEBHOOK');
  assert.equal(report.steps.step3_firebaseUpdate.stockAfterWebhook.reservedQuantity, 0);
  assert.equal(report.steps.step3_firebaseUpdate.stockAfterWebhook.stockQuantity, 8);
});

test('Sicredi simulator requires administrator and never writes business data', async t => {
  const { firestoreRepo, app } = createTestEnvironment();
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const base = 'http://127.0.0.1:' + server.address().port;
  const post = (path, data, cookie) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(data) });
  assert.equal((await post('/api/admin/sicredi-pix/simulate', {})).status, 401);
  const cashier = await post('/api/admin/auth/login', { userId: 'usr-caixa1', pin: '0000' });
  assert.equal((await post('/api/admin/sicredi-pix/simulate', {}, cashier.headers.get('set-cookie').split(';')[0])).status, 403);
  const admin = await post('/api/admin/auth/login', { userId: 'usr-edmar', pin: '1234' });
  const cookie = admin.headers.get('set-cookie').split(';')[0];
  const before = JSON.stringify(await firestoreRepo.getAllProducts());
  const result = await post('/api/admin/sicredi-pix/simulate', { unitPrice: 19.99, quantity: 3 }, cookie);
  assert.equal(result.status, 200);
  const report = await result.json();
  assert.equal(report.isolatedSandbox, true);
  assert.equal(report.steps.step3_firebaseUpdate.duplicateIsIdempotent, true);
  assert.equal((await firestoreRepo.getAllOrders()).length, 0);
  assert.equal(JSON.stringify(await firestoreRepo.getAllProducts()), before);
  assert.equal((await post('/api/admin/sicredi-pix/simulate', { unitPrice: -1 }, cookie)).status, 400);
});
