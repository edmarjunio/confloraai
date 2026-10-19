process.env.NODE_ENV = 'test';
process.env.META_AGENT_API_KEY = 'conflora-agent-secret-key';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  priceToCents,
  numberToMilli,
  parseQuantity,
  checkQuantityRules,
  lineSubtotalCents,
  formatBRL,
  formatQuantity,
} = require('../src/agent/units');

const {
  FIELD_MAP,
  evaluateProduct,
} = require('../src/agent/product-contract');

const { ProductIndex } = require('../src/agent/product-search');
const { verifyCustomerMessage } = require('../src/agent/message-guard');
const { CartStore, HandoffStore, customerKeyFor } = require('../src/agent/agent-store');
const { ConfloraAgentService } = require('../src/agent/agent-service');
const { createApp } = require('../src/http/app');

// -------------------------------------------------------------
// Double em memória de Firestore de Alta Fidelidade
// Suporta: collection, doc, get, set, update, delete, batch, runTransaction, getAll, where, select
// -------------------------------------------------------------
function createInMemoryFirestore(initialData = {}) {
  const documents = new Map(Object.entries(initialData));
  let sequence = 0;

  const makeSnapshot = (path) => ({
    id: path.split('/').pop(),
    exists: documents.has(path),
    data: () => structuredClone(documents.get(path)),
    readTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
  });

  const firestore = {
    doc: (path) => ({
      id: path.split('/').pop(),
      path,
      get: async () => makeSnapshot(path),
      set: async (val, opts = {}) => {
        if (opts.merge && documents.has(path)) {
          documents.set(path, { ...documents.get(path), ...structuredClone(val) });
        } else {
          documents.set(path, structuredClone(val));
        }
      },
      update: async (val) => {
        if (!documents.has(path)) throw new Error(`Not found: ${path}`);
        documents.set(path, { ...documents.get(path), ...structuredClone(val) });
      },
      delete: async () => {
        documents.delete(path);
      },
    }),
    collection: (collName) => {
      const getDocsInternal = (filters = []) => {
        const docs = [];
        const prefix = `${collName}/`;
        for (const [k, v] of documents.entries()) {
          if (k.startsWith(prefix) && !k.slice(prefix.length).includes('/')) {
            let pass = true;
            for (const f of filters) {
              if (v[f.field] !== f.value) { pass = false; break; }
            }
            if (pass) {
              docs.push(makeSnapshot(k));
            }
          }
        }
        return docs;
      };

      const makeQuery = (filters = []) => ({
        where: (field, op, value) => {
          assert.equal(op, '==');
          return makeQuery([...filters, { field, value }]);
        },
        limit: (n) => ({
          get: async () => {
            const list = getDocsInternal(filters).slice(0, n);
            return { docs: list, empty: list.length === 0, size: list.length };
          },
        }),
        select: (...fields) => ({
          get: async () => {
            const list = getDocsInternal(filters).map(d => {
              const fullData = d.data();
              const projected = {};
              for (const f of fields) {
                if (fullData[f] !== undefined) projected[f] = fullData[f];
              }
              return { ...d, data: () => projected };
            });
            return { docs: list, empty: list.length === 0, size: list.length };
          },
        }),
        get: async () => {
          const list = getDocsInternal(filters);
          return { docs: list, empty: list.length === 0, size: list.length };
        },
      });

      return {
        doc: (id) => {
          const docId = id || `doc_${++sequence}`;
          return firestore.doc(`${collName}/${docId}`);
        },
        ...makeQuery([]),
      };
    },
    getAll: async (...refs) => {
      return refs.map(ref => makeSnapshot(ref.path));
    },
    batch: () => {
      const writes = [];
      return {
        set: (ref, val, opts = {}) => writes.push({ type: 'set', path: ref.path, val, opts }),
        update: (ref, val) => writes.push({ type: 'update', path: ref.path, val }),
        delete: (ref) => writes.push({ type: 'delete', path: ref.path }),
        commit: async () => {
          for (const w of writes) {
            if (w.type === 'delete') {
              documents.delete(w.path);
            } else if (w.type === 'update') {
              documents.set(w.path, { ...documents.get(w.path), ...structuredClone(w.val) });
            } else if (w.opts && w.opts.merge && documents.has(w.path)) {
              documents.set(w.path, { ...documents.get(w.path), ...structuredClone(w.val) });
            } else {
              documents.set(w.path, structuredClone(w.val));
            }
          }
        },
      };
    },
    runTransaction: async (callback) => {
      const writes = [];
      const tx = {
        get: async (ref) => makeSnapshot(ref.path),
        set: (ref, val, opts = {}) => writes.push({ type: 'set', path: ref.path, val, opts }),
        update: (ref, val) => writes.push({ type: 'update', path: ref.path, val }),
        delete: (ref) => writes.push({ type: 'delete', path: ref.path }),
      };
      const res = await callback(tx);
      for (const w of writes) {
        if (w.type === 'delete') {
          documents.delete(w.path);
        } else if (w.type === 'update') {
          documents.set(w.path, { ...documents.get(w.path), ...structuredClone(w.val) });
        } else if (w.opts && w.opts.merge && documents.has(w.path)) {
          documents.set(w.path, { ...documents.get(w.path), ...structuredClone(w.val) });
        } else {
          documents.set(w.path, structuredClone(w.val));
        }
      }
      return res;
    },
    raw: documents,
  };

  return firestore;
}

// -------------------------------------------------------------
// 1. Testes de Unidades e Matemática Financeira (Centavos/Milésimos)
// -------------------------------------------------------------
test('Unidades e Finanças: conversões estritas de centavos e arredondamento half-up', () => {
  // Preços em centavos
  assert.equal(priceToCents(15.9), 1590);
  assert.equal(priceToCents('15,90'), 1590);
  assert.equal(priceToCents('15.90'), 1590);
  assert.equal(priceToCents(0.05), 5);

  assert.equal(priceToCents(0), null);
  assert.equal(priceToCents(-10), null);
  assert.equal(priceToCents('abc'), null);
  assert.equal(priceToCents(null), null);

  // Quantidades em milésimos
  assert.equal(numberToMilli(1), 1000);
  assert.equal(numberToMilli(0.5), 500);
  assert.equal(numberToMilli('1.25'), 1250);

  // UN: apenas quantidade inteira
  assert.deepEqual(parseQuantity(1.5, 'UN'), { error: 'quantity_not_integer_for_unit' });
  assert.deepEqual(parseQuantity(3, 'UN'), { milli: 3000 });

  // KG: fracionário permitido respeitando passo e mínimo
  assert.deepEqual(parseQuantity(0.5, 'KG'), { milli: 500 });
  assert.deepEqual(parseQuantity('1,25', 'KG'), { milli: 1250 });
  const kgRules = { minMilli: 100, incMilli: 50 };
  assert.equal(checkQuantityRules(50, kgRules), 'quantity_below_minimum');
  assert.equal(checkQuantityRules(120, kgRules), 'quantity_not_multiple_of_increment');
  assert.equal(checkQuantityRules(250, kgRules), null);

  // Subtotal com half-up rounding exato em centavos inteiros
  // 1.5 kg a R$ 10,00/kg = R$ 15,00 (1500 centavos)
  assert.equal(lineSubtotalCents(1000, 1500), 1500);
  // 0.333 kg a R$ 10,00/kg = 333 centavos
  assert.equal(lineSubtotalCents(1000, 333), 333);

  // Formatação
  assert.equal(formatBRL(1590), 'R$ 15,90');
  assert.equal(formatQuantity(1000, 'UN'), '1');
  assert.equal(formatQuantity(1500, 'KG'), '1,5');
});

// -------------------------------------------------------------
// 2. Contrato de Produto e Integridade dos Campos
// -------------------------------------------------------------
test('Contrato de Produto: mapeamento real do Firestore e bloqueio de conflitos/inativos', () => {
  // Produto válido ativo
  const validDoc = {
    id: 'prod_hortela_01',
    data: {
      name: 'Muda de Hortelã',
      price: 6.5,
      unit: 'UN',
      status: 'active',
      stockQuantity: 15,
      category: 'Ervas',
    },
  };
  const resValid = evaluateProduct(validDoc, { assertAvailability: false });
  assert.equal(resValid.ok, true);
  assert.equal(resValid.product.name, 'Muda de Hortelã');
  assert.equal(resValid.product.priceCents, 650);
  assert.equal(resValid.product.unit, 'UN');

  // Produto inativo -> bloqueado
  const inactiveDoc = {
    id: 'prod_02',
    data: {
      name: 'Alecrim Inativo',
      price: 7.0,
      unit: 'UN',
      status: 'inactive',
    },
  };
  const resInactive = evaluateProduct(inactiveDoc);
  assert.equal(resInactive.ok, false);
  assert.ok(resInactive.blockingCodes.includes('product_inactive'));

  // Conflito de preços (ex: price 10 vs valor_num 12) -> bloqueado
  const conflictingDoc = {
    id: 'prod_03',
    data: {
      name: 'Manjericão com Conflito',
      price: 10.0,
      valor_num: 12.0,
      unit: 'UN',
    },
  };
  const resConflict = evaluateProduct(conflictingDoc);
  assert.equal(resConflict.ok, false);
  assert.ok(resConflict.blockingCodes.includes('price_conflict'));

  // Promoção sem regra comercial vigente -> bloqueado
  const promoDoc = {
    id: 'prod_promo',
    data: {
      name: 'Tomate em Promoção Não Verificada',
      price: 8.0,
      unit: 'UN',
      promocao: true,
    },
  };
  const resPromo = evaluateProduct(promoDoc);
  assert.equal(resPromo.ok, false);
  assert.ok(resPromo.blockingCodes.includes('promo_unverified'));
});

// -------------------------------------------------------------
// 3. Busca Precisa, Resolução de Ambiguidade e Sinônimos
// -------------------------------------------------------------
test('Busca Precisa: resolução exata por ID, nome e sinônimo; detecção de ambiguidade', async () => {
  const dummySource = {
    listIdentity: async () => [
      { id: 'p1', data: { name: 'Muda de Hortelã Pimenta', status: 'ATIVO', category: 'Ervas' } },
      { id: 'p2', data: { name: 'Muda de Hortelã Comum', status: 'ATIVO', category: 'Ervas' } },
      { id: 'p3', data: { name: 'Adubo Orgânico Bokashi 1kg', status: 'ATIVO', category: 'Adubos' } },
    ],
    listApprovedSynonyms: async () => [
      { id: 's1', term: 'bokashi', productIds: ['p3'], approved: true },
      // Sinônimo apontando para dois produtos -> ambiguidade
      { id: 's2', term: 'menta', productIds: ['p1', 'p2'], approved: true },
    ],
  };

  const index = new ProductIndex({ source: dummySource });
  await index.refresh();

  // 1. Busca por ID exato
  const byId = index.resolve('p3');
  assert.equal(byId.outcome, 'found');
  assert.equal(byId.entry.id, 'p3');

  // 2. Busca por nome exato normalizado
  const byName = index.resolve('Muda de Hortelã Pimenta');
  assert.equal(byName.outcome, 'found');
  assert.equal(byName.entry.id, 'p1');

  // 3. Busca por sinônimo aprovado unívoco
  const bySyn = index.resolve('bokashi');
  assert.equal(bySyn.outcome, 'found');
  assert.equal(bySyn.entry.id, 'p3');

  // 4. Sinônimo ambíguo apontando para 2 produtos
  const byAmbiguousSyn = index.resolve('menta');
  assert.equal(byAmbiguousSyn.outcome, 'ambiguous');
  assert.equal(byAmbiguousSyn.reason, 'synonym_multiple');
  assert.equal(byAmbiguousSyn.candidates.length, 2);

  // 5. Termo que combina com múltiplos produtos ("hortelã")
  const byMultiple = index.resolve('hortela');
  assert.equal(byMultiple.outcome, 'ambiguous');
  assert.equal(byMultiple.candidates.length, 2);

  // 6. Produto inexistente -> not_found (NÃO aceita substituição por produto parecido)
  const notFound = index.resolve('Trator Agrícola 5000');
  assert.equal(notFound.outcome, 'not_found');

  // 7. Busca por categoria
  const catList = index.findCategory({ category: 'Ervas', limit: 10 });
  assert.equal(catList.totalFound, 2);
  assert.equal(catList.items.length, 2);
});

// -------------------------------------------------------------
// 4. Message Guard: Bloqueio de Frases Proibidas e Placeholders
// -------------------------------------------------------------
test('Message Guard: rejeição de vazamentos, placeholders e frases proibidas', () => {
  // Mensagem válida
  const okMsg = '🌿 *Muda de Hortelã*\n• Valor: *R$ 6,50 / UN*\n\nVocê precisa de mais algum produto?';
  const okCheck = verifyCustomerMessage(okMsg, { allowedCents: [650] });
  assert.equal(okCheck.ok, true);

  // Bloqueio de frases proibidas ("não encontrei", "aguarde")
  const forbidden1 = verifyCustomerMessage('Desculpe, não encontrei seu produto.');
  assert.equal(forbidden1.ok, false);
  assert.ok(forbidden1.failures.includes('forbidden_phrase'));

  const forbidden2 = verifyCustomerMessage('Aguarde um momento por favor.');
  assert.equal(forbidden2.ok, false);
  assert.ok(forbidden2.failures.includes('forbidden_phrase'));

  // Bloqueio de placeholders
  const placeholder1 = verifyCustomerMessage('O valor é {{preco}}');
  assert.equal(placeholder1.ok, false);
  assert.ok(placeholder1.failures.includes('internal_or_placeholder_content'));

  const placeholder2 = verifyCustomerMessage('Temos undefined unidades');
  assert.equal(placeholder2.ok, false);
  assert.ok(placeholder2.failures.includes('internal_or_placeholder_content'));

  // Bloqueio de preço não autorizado pelo backend (anti-alucinação)
  const unauthPrice = verifyCustomerMessage('O valor é R$ 99,90', { allowedCents: [1000] });
  assert.equal(unauthPrice.ok, false);
  assert.ok(unauthPrice.failures.some(f => f.startsWith('unauthorized_amount')));
});

// -------------------------------------------------------------
// 5. Teste de Fluxo Completo do ConfloraAgentService (com Firestore Mock)
// -------------------------------------------------------------
test('Agent Service: consulta, adição ao carrinho, alteração, finalização e handoff silencioso', async () => {
  const store = createInMemoryFirestore({
    'store_settings/inventory': { stockControlEnabled: true },
    'products/p_tomate': {
      name: 'Muda de Tomate Cereja',
      price: 5.0,
      unit: 'UN',
      status: 'active',
      stockQuantity: 20,
      category: 'Hortaliças',
    },
    'products/p_alface': {
      name: 'Alface Americana Hidropônica',
      price: 3.5,
      unit: 'UN',
      status: 'active',
      stockQuantity: 15,
      category: 'Hortaliças',
    },
    'agent_synonyms/syn_tomatinho': {
      term: 'tomatinho',
      productIds: ['p_tomate'],
      approved: true,
    },
  });

  const { FirestoreProductSource } = require('../src/agent/product-source');
  const productSource = new FirestoreProductSource(store);
  const productIndex = new ProductIndex({ source: productSource });
  const cartStore = new CartStore(store);
  const handoffStore = new HandoffStore(store);

  const service = new ConfloraAgentService({
    productSource,
    productIndex,
    cartStore,
    handoffStore,
    timeoutMs: 3000,
  });

  const customerPhone = '5564999991234';

  // 1. Consultar produto por sinônimo ("tomatinho")
  const consultRes = await service.execute('consultar_produto', {
    customer_phone: customerPhone,
    query: 'tomatinho',
  });
  assert.equal(consultRes.status, 'found');
  assert.equal(consultRes.next_action.send_customer_message, true);
  assert.match(consultRes.data.customer_message, /Muda de Tomate Cereja/);
  assert.match(consultRes.data.customer_message, /R\$ 5,00 \/ unidade/);
  assert.match(consultRes.data.customer_message, /Você precisa de mais algum produto\?/);

  // 2. Adicionar 2 mudas de tomate ao carrinho
  const addRes = await service.execute('adicionar_item', {
    customer_phone: customerPhone,
    message_id: 'msg_001',
    product_id: 'p_tomate',
    quantity: 2,
  });
  assert.equal(addRes.status, 'found');
  assert.equal(addRes.data.added_lines.length, 1);
  assert.equal(addRes.data.added_lines[0].subtotalCents, 1000); // 2 * 500
  assert.match(addRes.data.customer_message, /Adicionado ao carrinho/);

  // Idempotência: mesma operação com mesmo message_id não duplica
  const addRepeat = await service.execute('adicionar_item', {
    customer_phone: customerPhone,
    message_id: 'msg_001',
    product_id: 'p_tomate',
    quantity: 2,
  });
  assert.equal(addRepeat.status, 'found');
  assert.equal(addRepeat.data.replayed, true);

  // 3. Adicionar 1 pé de alface
  await service.execute('adicionar_item', {
    customer_phone: customerPhone,
    message_id: 'msg_002',
    product_id: 'p_alface',
    quantity: 1,
  });

  // 4. Consultar carrinho
  const cartRes = await service.execute('consultar_carrinho', {
    customer_phone: customerPhone,
  });
  assert.equal(cartRes.status, 'found');
  assert.equal(cartRes.data.cart.items_count, 2);
  assert.equal(cartRes.data.cart.subtotal_cents, 1350); // 1000 + 350
  assert.match(cartRes.data.customer_message, /Muda de Tomate Cereja/);
  assert.match(cartRes.data.customer_message, /Alface Americana/);

  // 5. Alterar quantidade do tomate para 3
  const alterRes = await service.execute('alterar_quantidade', {
    customer_phone: customerPhone,
    message_id: 'msg_003',
    product_id: 'p_tomate',
    quantity: 3,
  });
  assert.equal(alterRes.status, 'found');
  assert.equal(alterRes.data.updated_line.quantityMilli, 3000);
  assert.equal(alterRes.data.updated_line.subtotalCents, 1500);

  // 6. Preparar finalização do carrinho
  const prepRes = await service.execute('preparar_finalizacao', {
    customer_phone: customerPhone,
    message_id: 'msg_004',
  });
  assert.equal(prepRes.status, 'found');
  assert.equal(prepRes.data.cart_summary.subtotal_cents, 1850);
  assert.match(prepRes.data.customer_message, /Seu carrinho/);
  assert.match(prepRes.data.customer_message, /Valores conferidos agora no cadastro/);

  // 7. Remover o alface
  const remRes = await service.execute('remover_item', {
    customer_phone: customerPhone,
    message_id: 'msg_005',
    product_id: 'p_alface',
  });
  assert.equal(remRes.status, 'found');
  assert.equal(remRes.data.removed_line.name, 'Alface Americana Hidropônica');

  // 8. Handoff Silencioso: produto não encontrado
  const notFoundRes = await service.execute('consultar_produto', {
    customer_phone: customerPhone,
    query: 'Muda de Jabuticaba Adulta Inexistente',
  });
  assert.equal(notFoundRes.status, 'handoff');
  // Silêncio absoluto: sem mensagem ao cliente
  assert.equal(notFoundRes.next_action.send_customer_message, false);
  assert.equal(notFoundRes.next_action.handoff_to_human, true);
  assert.equal(notFoundRes.data.customer_message, undefined);

  // Verificar se o handoff foi registrado
  const openHandoffs = await handoffStore.listOpen('conflora');
  assert.equal(openHandoffs.length, 1);
  assert.equal(openHandoffs[0].customerPhone, customerPhone);
  assert.equal(openHandoffs[0].reason, 'product_not_found');

  // Verificar se a conversa está com automação pausada
  const key = customerKeyFor('conflora', customerPhone);
  const conv = await handoffStore.getConversation('conflora', key);
  assert.equal(conv.automation, 'paused');

  // 9. Com a automação pausada, requisição entra em handoff imediato sem falar com o cliente
  const pausedRes = await service.execute('consultar_produto', {
    customer_phone: customerPhone,
    query: 'tomatinho',
  });
  assert.equal(pausedRes.status, 'handoff');
  assert.equal(pausedRes.provenance.reason, 'conversation_already_paused');

  // 10. Retomada da automação por atendente humano
  const resumeResult = await handoffStore.resume('conflora', openHandoffs[0].id, {
    id: 'atendente_marcos',
    role: 'support',
  });
  assert.equal(resumeResult.ok, true);

  // Automação volta a responder normalmente
  const unpausedRes = await service.execute('consultar_produto', {
    customer_phone: customerPhone,
    query: 'tomatinho',
  });
  assert.equal(unpausedRes.status, 'found');
  assert.match(unpausedRes.data.customer_message, /Muda de Tomate Cereja/);
});

// -------------------------------------------------------------
// 6. Teste dos Endpoints HTTP e Autenticação
// -------------------------------------------------------------
test('HTTP Endpoints: autenticação por token X-Conflora-Agent-Key e execução de tools', async (t) => {
  const store = createInMemoryFirestore({
    'products/p_hortela': {
      name: 'Muda de Hortelã',
      price: 6.0,
      unit: 'UN',
      status: 'active',
      stockQuantity: 10,
    },
  });

  const { FirestoreProductSource } = require('../src/agent/product-source');
  const productSource = new FirestoreProductSource(store);
  const productIndex = new ProductIndex({ source: productSource });
  const cartStore = new CartStore(store);
  const handoffStore = new HandoffStore(store);

  const metaAgentService = new ConfloraAgentService({
    productSource,
    productIndex,
    cartStore,
    handoffStore,
  });

  const app = createApp({
    messageService: {
      metaAgentService,
      firestoreRepo: { firestore: store },
      catalogRepo: { items: [], refreshCatalog: async () => {} },
    },
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const validKey = process.env.META_AGENT_API_KEY || 'conflora-agent-secret-key-prod';

  // 1. Rejeição com 401 sem header de chave
  const unauth = await fetch(`${baseUrl}/api/meta-agent/tools/consultar_produto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_phone: '5564999990000', query: 'Muda de Hortelã' }),
  });
  assert.equal(unauth.status, 401);

  // 2. Chamada autenticada via POST com retorno do envelope oficial
  const authCall = await fetch(`${baseUrl}/api/meta-agent/tools/consultar_produto`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Conflora-Agent-Key': validKey,
    },
    body: JSON.stringify({
      customer_phone: '5564999990000',
      query: 'Muda de Hortelã',
    }),
  });
  assert.equal(authCall.status, 200);
  const body = await authCall.json();
  assert.equal(body.status, 'found');
  assert.equal(body.data.products[0].name, 'Muda de Hortelã');
  assert.equal(body.data.products[0].price_cents, 600);
  assert.match(body.data.customer_message, /Muda de Hortelã/);

  // 3. Catálogo de Tools e especificações para a Meta
  const toolsSpec = await fetch(`${baseUrl}/api/meta-agent/tools-spec`, {
    headers: { 'X-Conflora-Agent-Key': validKey },
  });
  assert.equal(toolsSpec.status, 200);
  const specData = await toolsSpec.json();
  assert.equal(Array.isArray(specData.tools), true);
  assert.equal(specData.tools.length, 8);
});
