'use strict';

const { newRequestId, TimeoutError } = require('./util');
const { parseInput, assertEnvelope } = require('./schema');
const { evaluateProduct } = require('./product-contract');
const { parseQuantity, checkQuantityRules, lineSubtotalCents } = require('./units');
const { buildChecks, passed } = require('./validation');
const { priceCards, productList, added, quantityChanged, removed, cartSummary, priceChanges, checkoutSummary } = require('./templates');
const { verifyCustomerMessage } = require('./message-guard');
const { customerKeyFor } = require('./agent-store');
const { interpretTraits, satisfiesTraits } = require('./plant-search');
const { normalizeName } = require('./util');
const { verifiedProductImage } = require('./product-image');

class ConfloraAgentService {
  /**
   * @param {Object} options
   * @param {import('./product-source').FirestoreProductSource} options.productSource
   * @param {import('./product-search').ProductIndex} options.productIndex
   * @param {import('./agent-store').CartStore} options.cartStore
   * @param {import('./agent-store').HandoffStore} options.handoffStore
   * @param {string} [options.tenantId='conflora']
   * @param {boolean} [options.assertAvailability=false]
   * @param {number} [options.timeoutMs=5000]
   */
  constructor({
    productSource,
    productIndex,
    cartStore,
    handoffStore,
    tenantId = 'conflora',
    assertAvailability = false,
    timeoutMs = 5000,
    imageResolver = verifiedProductImage,
  }) {
    if (!productSource || !productIndex || !cartStore || !handoffStore) {
      throw new Error('ConfloraAgentService requer productSource, productIndex, cartStore e handoffStore.');
    }
    this.productSource = productSource;
    this.productIndex = productIndex;
    this.cartStore = cartStore;
    this.handoffStore = handoffStore;
    this.tenantId = tenantId;
    this.assertAvailability = assertAvailability;
    this.timeoutMs = timeoutMs;
    this.imageResolver = imageResolver;
    this.metrics = { requests: 0, found: 0, handoffs: 0, errors: 0, latencyMs: 0 };
  }

  /**
   * Ponto de entrada universal para execução de qualquer operação do contrato.
   * @param {string} operation
   * @param {Object} rawInput
   * @returns {Promise<Object>} Envelope validado
   */
  async execute(operation, rawInput, options = {}) {
    const result = await this._execute(operation, rawInput, options);
    this.metrics.requests++;
    this.metrics.latencyMs += result.latency_ms;
    if (result.status === 'found') this.metrics.found++;
    else if (result.status === 'handoff') this.metrics.handoffs++;
    else this.metrics.errors++;
    require('../shared/logger').info('catalog_agent_result', {
      requestId: result.request_id, operation, status: result.status, latencyMs: result.latency_ms,
      reason: result.status === 'handoff' ? result.provenance.reason : undefined,
    });
    return result;
  }

  async _execute(operation, rawInput, options) {
    const requestId = newRequestId();
    const startMs = Date.now();

    let parsed;
    try {
      parsed = parseInput(operation, rawInput);
    } catch (err) {
      return assertEnvelope(this._buildEnvelope({
        requestId,
        status: 'invalid_input',
        error: { code: err.code || 'invalid_input', field: err.field, message: err.message },
        nextAction: { send_customer_message: false, handoff_to_human: false },
        latencyMs: Date.now() - startMs,
      }));
    }

    const customerKey = customerKeyFor(this.tenantId, parsed.customerPhone);
    const scope = { requestId, customerKey, parsed, startMs, rememberProducts: options.rememberProducts !== false };

    try {
      return await this._runWithTimeout(async () => {
        // 1. Checagem de conversa pausada (Atendimento Humano Ativo)
        const conv = await this.handoffStore.getConversation(this.tenantId, customerKey);
        if (conv.automation === 'paused') {
          return this._buildHandoffEnvelope(scope, 'conversation_already_paused', {
            detail: 'Conversa em atendimento humano. Automação pausada silenciosamente.',
          });
        }

        switch (operation) {
          case 'atender_mensagem':
            return await this._atenderMensagem(scope, conv);
          case 'consultar_produto':
            return await this._consultarProduto(scope);
          case 'buscar_produtos':
            return await this._buscarProdutos(scope);
          case 'consultar_carrinho':
            return await this._consultarCarrinho(scope);
          case 'adicionar_item':
            return await this._adicionarItem(scope);
          case 'alterar_quantidade':
            return await this._alterarQuantidade(scope);
          case 'remover_item':
            return await this._removerItem(scope);
          case 'preparar_finalizacao':
            return await this._prepararFinalizacao(scope);
          case 'encaminhar_atendente':
            return await this._encaminharAtendente(scope);
          default:
            return this._buildEnvelope({
              requestId,
              status: 'error',
              error: { code: 'unsupported_operation', message: operation },
              nextAction: { send_customer_message: false, handoff_to_human: false },
              latencyMs: Date.now() - startMs,
            });
        }
      });
    } catch (error) {
      // Falha ou Timeout -> Handoff silencioso
      const isTimeout = error instanceof TimeoutError || error.code === 'TIMEOUT';
      const reason = isTimeout ? 'timeout' : 'internal_error';
      return await this._triggerSilentHandoff(scope, reason, {
        detail: error.message,
      });
    }
  }

  async _runWithTimeout(fn) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError('operação do agente', this.timeoutMs)), this.timeoutMs);
    });
    return Promise.race([fn(), timeoutPromise]).finally(() => clearTimeout(timer));
  }

  // --- Operações de Negócio ---

  async _consultarProduto(scope) {
    const { parsed } = scope;
    await this.productIndex.ensureFresh();

    // 1. Resolver todas as referências no índice
    const resolutions = [];
    for (const ref of parsed.refs) {
      if (ref.productId) {
        const entry = this.productIndex.byId.get(ref.productId);
        if (entry) resolutions.push({ ref, outcome: 'found', entry });
        else resolutions.push({ ref, outcome: 'not_found', reason: 'id_not_found' });
      } else {
        const res = this.productIndex.resolve(ref.query);
        resolutions.push({ ref, ...res });
      }
    }

    // Se algum item for ambíguo ou não encontrado -> Handoff silencioso para a mensagem toda
    for (const res of resolutions) {
      if (res.outcome === 'ambiguous') {
        return await this._triggerSilentHandoff(scope, 'ambiguous_product', {
          query: res.ref.query,
          candidates: res.candidates?.map((c) => ({ id: c.id, name: c.name })),
        });
      }
      if (res.outcome === 'not_found') {
        return await this._triggerSilentHandoff(scope, 'product_not_found', {
          query: res.ref.query,
          candidates: res.candidates,
        });
      }
    }

    // 2. Leitura atual do Firestore para os itens encontrados
    const ids = resolutions.map((r) => r.entry.id);
    const [rawDocs, stockControl] = await Promise.all([
      this.productSource.getProducts(ids),
      this.productSource.getStockControl(),
    ]);

    const ctx = {
      assertAvailability: this.assertAvailability && parsed.intent === 'disponibilidade',
      stockControlEnabled: stockControl.value,
    };

    const evaluatedProducts = [];
    const sourceRecords = [];
    const allowedCents = [];

    if (rawDocs.length !== ids.length) return this._triggerSilentHandoff(scope, 'incomplete_product_read', {});
    for (const raw of rawDocs) {
      if (!raw.exists) {
        return await this._triggerSilentHandoff(scope, 'product_not_found_on_read', { id: raw.id });
      }
      const evalRes = evaluateProduct(raw, ctx);
      const criteria = interpretTraits(parsed.criteriaQuery || '');
      if (criteria.constraints.length && !satisfiesTraits(raw.data, criteria.constraints)) return this._triggerSilentHandoff(scope, 'traits_changed', {});
      const indexed = resolutions.find(r => r.entry.id === raw.id)?.entry;
      if (evalRes.ok && indexed && normalizeName(evalRes.product.name) !== indexed.norm) return this._triggerSilentHandoff(scope, 'identity_changed', {});
      sourceRecords.push(evalRes.source);

      if (!evalRes.ok) {
        return await this._triggerSilentHandoff(scope, 'invalid_or_conflicted_product', {
          id: raw.id,
          issues: evalRes.issues,
        });
      }

      evaluatedProducts.push(evalRes.product);
      allowedCents.push(evalRes.product.priceCents);
    }

    // 3. Validação pré-envio
    const checks = buildChecks({
      request_understood: true,
      product_matches_request: true,
      variation_matches_request: true,
      record_active: evaluatedProducts.every((p) => p),
      required_field_present: evaluatedProducts.every((p) => p.priceCents && p.unit),
      price_currency_unit_coherent: true,
      availability_assertable: parsed.intent === 'disponibilidade' ? evaluatedProducts.every(p => p.stock.verified) : undefined,
      no_source_conflict: true,
      freshness_policy: true,
      message_only_confirmed_facts: true,
      conversation_allows_auto_reply: true,
    });

    if (!passed(checks)) {
      return await this._triggerSilentHandoff(scope, 'validation_failed', { checks });
    }

    // 4. Renderização com Templates Determinísticos
    const cards = evaluatedProducts.map((p) => ({
      product: p,
      availability: p.stock.verified ? (p.stock.availableMilli > 0 ? 'Disponível' : 'Indisponível') : undefined,
    }));

    const customerMessage = priceCards(cards);
    const productCards = await this._productCards(evaluatedProducts, rawDocs);
    if (parsed.intent === 'foto' && !productCards[0]?.image_url) return this._triggerSilentHandoff(scope, 'photo_unavailable', {});

    // 5. Guarda final da mensagem
    const guard = verifyCustomerMessage(customerMessage, { allowedCents });
    if (!guard.ok) {
      return await this._triggerSilentHandoff(scope, 'guard_violation', { failures: guard.failures });
    }

    return assertEnvelope(this._buildEnvelope({
      requestId: scope.requestId,
      status: 'found',
      data: {
        customer_message: customerMessage,
        cards: productCards,
        products: evaluatedProducts.map((p) => ({
          id: p.id,
          name: p.name,
          presentation: p.presentation,
          price_cents: p.priceCents,
          unit: p.unit,
        })),
      },
      validation: { checks, allowed_cents: allowedCents },
      provenance: { sources: sourceRecords, evaluated_at: new Date().toISOString() },
      nextAction: { send_customer_message: true, handoff_to_human: false },
      latencyMs: Date.now() - scope.startMs,
    }));
  }

  async _buscarProdutos(scope) {
    const { parsed } = scope;
    await this.productIndex.ensureFresh();

    const matchedEntries = this.productIndex.match({
      category: parsed.category,
      query: parsed.query,
    });

    if (matchedEntries.length === 0) {
      return await this._triggerSilentHandoff(scope, 'no_products_matching_filter', {
        query: parsed.query,
        category: parsed.category,
      });
    }

    const limit = Math.min(parsed.limit, 3);
    const limited = matchedEntries.slice(0, limit);
    const truncated = matchedEntries.length > limit;

    const ids = limited.map((e) => e.id);
    const rawDocs = await this.productSource.getProducts(ids);
    if (rawDocs.length !== ids.length) return this._triggerSilentHandoff(scope, 'incomplete_product_read', {});

    const validProducts = [];
    const sourceRecords = [];
    const allowedCents = [];

    for (const raw of rawDocs) {
      if (!raw.exists) return this._triggerSilentHandoff(scope, 'product_not_found_on_read', {});
      const traits = interpretTraits(parsed.query);
      if (traits.constraints.length && !satisfiesTraits(raw.data, traits.constraints)) return this._triggerSilentHandoff(scope, 'traits_changed', {});
      const evalRes = evaluateProduct(raw, { assertAvailability: false });
      if (!evalRes.ok) return this._triggerSilentHandoff(scope, 'invalid_or_conflicted_product', { id: raw.id, issues: evalRes.issues });
      if (evalRes.ok) {
        validProducts.push(evalRes.product);
        sourceRecords.push(evalRes.source);
        allowedCents.push(evalRes.product.priceCents);
      }
    }

    if (validProducts.length === 0) {
      return await this._triggerSilentHandoff(scope, 'all_matching_products_invalid', {});
    }

    const heading = 'Opções cadastradas';
    const customerMessage = productList({ items: validProducts, truncated, heading });
    const productCards = await this._productCards(validProducts, rawDocs);

    const checks = buildChecks({
      request_understood: true,
      product_matches_request: true,
      record_active: true,
      required_field_present: true,
      price_currency_unit_coherent: true,
      no_source_conflict: true,
      freshness_policy: true,
      message_only_confirmed_facts: true,
      conversation_allows_auto_reply: true,
    });

    const guard = verifyCustomerMessage(customerMessage, { allowedCents });
    if (!guard.ok) {
      return await this._triggerSilentHandoff(scope, 'guard_violation', { failures: guard.failures });
    }

    return assertEnvelope(this._buildEnvelope({
      requestId: scope.requestId,
      status: 'found',
      data: {
        customer_message: customerMessage,
        cards: productCards,
        products: validProducts.map((p) => ({ id: p.id, name: p.name, price_cents: p.priceCents, unit: p.unit })),
        total_found: matchedEntries.length,
        displayed: validProducts.length,
        truncated,
      },
      validation: { checks, allowed_cents: allowedCents },
      provenance: { sources: sourceRecords, evaluated_at: new Date().toISOString() },
      nextAction: { send_customer_message: true, handoff_to_human: false },
      latencyMs: Date.now() - scope.startMs,
    }));
  }

  async _productCards(products, rawDocs) {
    return Promise.all(products.map(async p => ({
      id: p.id, name: p.name, presentation: p.presentation, price_cents: p.priceCents, unit: p.unit,
      image_url: products.length === 1 ? await this.imageResolver(rawDocs.find(doc => doc.id === p.id)?.data || {}) : null,
    })));
  }

  async _atenderMensagem(scope, conversation) {
    const text = normalizeName(scope.parsed.message);
    let result;
    if (/\b(atendente|humano|falar com alguem|falar com pessoa)\b/.test(text)) {
      return this._triggerSilentHandoff(scope, 'customer_requested_human', {});
    }
    // Purchasing/payment language is handled by the team; this read-only path cannot mutate carts.
    if (/\b(comprar|quero levar|reserva|reservar|pix|paguei|comprovante|pedido|carrinho)\b/.test(text)) {
      return this._triggerSilentHandoff(scope, 'outside_catalog_capabilities', {});
    }
    const photo = /\b(foto|fotos|imagem)\b/.test(text);
    const ordinal = text.match(/\b(primeira|primeiro|segunda|segundo|terceira|terceiro)\b/);
    const referring = ordinal || /\b(dela|dele|essa|esse)\b/.test(text);
    if (referring) {
      const ids = conversation.presentedProductIds || [];
      const index = ordinal ? ({ primeira: 0, primeiro: 0, segunda: 1, segundo: 1, terceira: 2, terceiro: 2 })[ordinal[1]] : ids.length === 1 ? 0 : -1;
      if (!ids[index] || Date.now() - Date.parse(conversation.presentedAt || '') > 86400000
        || /\b(menor|maior|cor|grande|pequena)\b/.test(text)) return this._triggerSilentHandoff(scope, 'ambiguous_reference', {});
      result = await this._consultarProduto({ ...scope, parsed: { ...scope.parsed, refs: [{ productId: ids[index] }], intent: photo ? 'foto' : 'preco' } });
    } else {
      const traits = interpretTraits(text);
      if (traits.constraints.length) {
        if (traits.unsupported) return this._triggerSilentHandoff(scope, 'unsupported_characteristics', {});
        result = await this._buscarProdutos({ ...scope, parsed: { ...scope.parsed, query: text, limit: 3 } });
      } else {
        let query = scope.parsed.message.trim().replace(/[?!.,]+$/g, '');
        query = query.replace(/^(?:ol[áa]|oi|bom dia|boa tarde|boa noite|opa)[!?,.\s]*/i, '').trim();
        query = query.replace(/^(?:quanto (?:custa|tá|ta|está|esta)|qual (?:o )?(?:preço|preco)(?: d[ao])?|(?:vocês?|voces?|vcs?)\s+(?:têm|tem)|tem|manda (?:uma )?foto d[ao]|foto d[ao])\s+/i, '').trim();
        query = query.replace(/^(?:a|o|as|os|da|do|das|dos|de)\s+/i, '').trim();
        await this.productIndex.ensureFresh();
        const resIdx = this.productIndex.resolve(query);
        if (resIdx.outcome === 'found') {
          result = await this._consultarProduto({ ...scope, parsed: { ...scope.parsed, refs: [{ query }], intent: photo ? 'foto' : 'preco' } });
        } else if (resIdx.outcome === 'ambiguous') {
          return this._triggerSilentHandoff(scope, 'ambiguous_product', { query });
        } else {
          result = await this._buscarProdutos({ ...scope, parsed: { ...scope.parsed, query, limit: 3 } });
        }
      }
    }
    if (result.next_action.send_customer_message) {
      result.data.photo_requested = photo;
      result.data.criteria_query = interpretTraits(text).constraints.length ? scope.parsed.message : '';
      // Recheck pause after reads, before authorizing any outgoing response.
      const remembered = referring || !scope.rememberProducts ? (await this.handoffStore.getConversation(this.tenantId, scope.customerKey)).automation !== 'paused'
        : await this.handoffStore.rememberProducts(this.tenantId, scope.customerKey, result.data.products);
      if (!remembered) return this._buildHandoffEnvelope(scope, 'conversation_already_paused', {});
    }
    return result;
  }

  async _consultarCarrinho(scope) {
    const cart = await this.cartStore.load(this.tenantId, scope.customerKey);
    const lines = cart.lines || [];
    const subtotalCents = lines.reduce((acc, l) => acc + l.subtotalCents, 0);

    const allowedCents = [subtotalCents, ...lines.map((l) => l.priceCents), ...lines.map((l) => l.subtotalCents)];
    const customerMessage = cartSummary(lines, subtotalCents);

    const guard = verifyCustomerMessage(customerMessage, { allowedCents });
    if (!guard.ok) {
      return await this._triggerSilentHandoff(scope, 'guard_violation', { failures: guard.failures });
    }

    return assertEnvelope(this._buildEnvelope({
      requestId: scope.requestId,
      status: 'found',
      data: {
        customer_message: customerMessage,
        cart: {
          items_count: lines.length,
          subtotal_cents: subtotalCents,
          lines,
        },
      },
      validation: { checks: buildChecks({ conversation_allows_auto_reply: true }), allowed_cents: allowedCents },
      provenance: { cart_version: cart.version, updatedAt: cart.updatedAt },
      nextAction: { send_customer_message: true, handoff_to_human: false },
      latencyMs: Date.now() - scope.startMs,
    }));
  }

  async _adicionarItem(scope) {
    const { parsed, customerKey } = scope;
    await this.productIndex.ensureFresh();

    // 1. Resolução de cada item do lote
    const itemsToAdd = [];
    for (const item of parsed.items) {
      let resolvedEntry;
      if (item.productId) {
        resolvedEntry = this.productIndex.byId.get(item.productId);
        if (!resolvedEntry) return await this._triggerSilentHandoff(scope, 'product_not_found', { id: item.productId });
      } else {
        const res = this.productIndex.resolve(item.query);
        if (res.outcome !== 'found') {
          return await this._triggerSilentHandoff(scope, res.outcome === 'ambiguous' ? 'ambiguous_product' : 'product_not_found', {
            query: item.query,
            candidates: res.candidates,
          });
        }
        resolvedEntry = res.entry;
      }
      itemsToAdd.push({ entry: resolvedEntry, rawQuantity: item.quantity });
    }

    // 2. Leitura atual do Firestore para os produtos reais
    const ids = itemsToAdd.map((i) => i.entry.id);
    const rawDocs = await this.productSource.getProducts(ids);
    const evaluatedMap = new Map();
    const sourceRecords = [];

    for (const raw of rawDocs) {
      if (!raw.exists) return await this._triggerSilentHandoff(scope, 'product_not_found_on_read', { id: raw.id });
      const evalRes = evaluateProduct(raw, { assertAvailability: false });
      if (!evalRes.ok) return await this._triggerSilentHandoff(scope, 'invalid_product_state', { id: raw.id, issues: evalRes.issues });
      evaluatedMap.set(String(raw.id), evalRes.product);
      sourceRecords.push(evalRes.source);
    }

    // 3. Validação de Quantidade & Unidade
    const resolvedLinesToAdd = [];
    for (const item of itemsToAdd) {
      const prod = evaluatedMap.get(item.entry.id);
      const parsedQty = parseQuantity(item.rawQuantity, prod.unit);
      if (parsedQty.error) {
        return await this._triggerSilentHandoff(scope, 'invalid_quantity_for_unit', {
          product: prod.name,
          unit: prod.unit,
          quantity: item.rawQuantity,
          reason: parsedQty.error,
        });
      }
      const ruleError = checkQuantityRules(parsedQty.milli, prod.saleUnit);
      if (ruleError) {
        return await this._triggerSilentHandoff(scope, 'quantity_violates_unit_rules', {
          product: prod.name,
          unit: prod.unit,
          quantityMilli: parsedQty.milli,
          reason: ruleError,
        });
      }

      resolvedLinesToAdd.push({
        productId: prod.id,
        name: prod.name,
        presentation: prod.presentation,
        unit: prod.unit,
        priceCents: prod.priceCents,
        quantityMilli: parsedQty.milli,
        saleUnit: prod.saleUnit,
      });
    }

    // 4. Mutação Atômica do Carrinho
    const opKey = `add_${parsed.messageId}`;
    const mutationResult = await this.cartStore.mutate(this.tenantId, customerKey, opKey, (cart) => {
      const existingLines = [...cart.lines];
      const newlyAddedLines = [];

      for (const line of resolvedLinesToAdd) {
        const existingIdx = existingLines.findIndex((l) => l.productId === line.productId);
        let lineResult;
        if (existingIdx >= 0) {
          const old = existingLines[existingIdx];
          const newQtyMilli = old.quantityMilli + line.quantityMilli;
          const newSubtotal = lineSubtotalCents(line.priceCents, newQtyMilli);
          const updatedLine = {
            ...old,
            quantityMilli: newQtyMilli,
            priceCents: line.priceCents, // atualiza com o preço vigente verificado
            subtotalCents: newSubtotal,
            updatedAt: new Date().toISOString(),
          };
          existingLines[existingIdx] = updatedLine;
          lineResult = updatedLine;
        } else {
          const subtotal = lineSubtotalCents(line.priceCents, line.quantityMilli);
          const newLine = {
            productId: line.productId,
            name: line.name,
            presentation: line.presentation,
            unit: line.unit,
            priceCents: line.priceCents,
            quantityMilli: line.quantityMilli,
            subtotalCents: subtotal,
            addedAt: new Date().toISOString(),
          };
          existingLines.push(newLine);
          lineResult = newLine;
        }
        newlyAddedLines.push(lineResult);
      }

      return {
        write: true,
        lines: existingLines,
        result: {
          addedLines: newlyAddedLines,
          totalLines: existingLines.length,
        },
      };
    });

    const addedLines = mutationResult.result.addedLines;
    const allowedCents = [];
    for (const l of addedLines) {
      allowedCents.push(l.priceCents);
      allowedCents.push(l.subtotalCents);
    }

    const customerMessage = added(addedLines);
    const guard = verifyCustomerMessage(customerMessage, { allowedCents });
    if (!guard.ok) {
      return await this._triggerSilentHandoff(scope, 'guard_violation', { failures: guard.failures });
    }

    return assertEnvelope(this._buildEnvelope({
      requestId: scope.requestId,
      status: 'found',
      data: {
        customer_message: customerMessage,
        replayed: mutationResult.replayed,
        added_lines: addedLines,
      },
      validation: { checks: buildChecks({ conversation_allows_auto_reply: true, price_currency_unit_coherent: true }), allowed_cents: allowedCents },
      provenance: { sources: sourceRecords, cart_version: mutationResult.version },
      nextAction: { send_customer_message: true, handoff_to_human: false },
      latencyMs: Date.now() - scope.startMs,
    }));
  }

  async _alterarQuantidade(scope) {
    const { parsed, customerKey } = scope;
    const cart = await this.cartStore.load(this.tenantId, customerKey);

    // Localizar a linha no carrinho
    let targetIdx = -1;
    if (parsed.ref.productId) {
      targetIdx = cart.lines.findIndex((l) => l.productId === parsed.ref.productId);
    } else {
      await this.productIndex.ensureFresh();
      const res = this.productIndex.resolve(parsed.ref.query);
      if (res.outcome === 'found') {
        targetIdx = cart.lines.findIndex((l) => l.productId === res.entry.id);
      }
    }

    if (targetIdx < 0) {
      return await this._triggerSilentHandoff(scope, 'item_not_in_cart', { ref: parsed.ref });
    }

    const targetLine = cart.lines[targetIdx];
    // Revalidar com o produto real no banco
    const [rawDoc] = await this.productSource.getProducts([targetLine.productId]);
    if (!rawDoc.exists) return await this._triggerSilentHandoff(scope, 'product_missing_on_firestore', { id: targetLine.productId });
    const evalRes = evaluateProduct(rawDoc, { assertAvailability: false });
    if (!evalRes.ok) return await this._triggerSilentHandoff(scope, 'invalid_product_state', { id: targetLine.productId });

    const prod = evalRes.product;
    const parsedQty = parseQuantity(parsed.quantity, prod.unit);
    if (parsedQty.error || checkQuantityRules(parsedQty.milli, prod.saleUnit)) {
      return await this._triggerSilentHandoff(scope, 'invalid_quantity_rules', { quantity: parsed.quantity, unit: prod.unit });
    }

    const opKey = `update_${parsed.messageId}`;
    const mutationResult = await this.cartStore.mutate(this.tenantId, customerKey, opKey, (c) => {
      const lines = [...c.lines];
      const newSubtotal = lineSubtotalCents(prod.priceCents, parsedQty.milli);
      const updated = {
        ...lines[targetIdx],
        priceCents: prod.priceCents,
        quantityMilli: parsedQty.milli,
        subtotalCents: newSubtotal,
        updatedAt: new Date().toISOString(),
      };
      lines[targetIdx] = updated;
      return { write: true, lines, result: { updatedLine: updated } };
    });

    const updatedLine = mutationResult.result.updatedLine;
    const allowedCents = [updatedLine.priceCents, updatedLine.subtotalCents];
    const customerMessage = quantityChanged(updatedLine);

    const guard = verifyCustomerMessage(customerMessage, { allowedCents });
    if (!guard.ok) {
      return await this._triggerSilentHandoff(scope, 'guard_violation', { failures: guard.failures });
    }

    return assertEnvelope(this._buildEnvelope({
      requestId: scope.requestId,
      status: 'found',
      data: { customer_message: customerMessage, updated_line: updatedLine },
      validation: { checks: buildChecks({ conversation_allows_auto_reply: true }), allowed_cents: allowedCents },
      provenance: { source: evalRes.source, cart_version: mutationResult.version },
      nextAction: { send_customer_message: true, handoff_to_human: false },
      latencyMs: Date.now() - scope.startMs,
    }));
  }

  async _removerItem(scope) {
    const { parsed, customerKey } = scope;
    const cart = await this.cartStore.load(this.tenantId, customerKey);

    let targetIdx = -1;
    if (parsed.ref.productId) {
      targetIdx = cart.lines.findIndex((l) => l.productId === parsed.ref.productId);
    } else {
      await this.productIndex.ensureFresh();
      const res = this.productIndex.resolve(parsed.ref.query);
      if (res.outcome === 'found') {
        targetIdx = cart.lines.findIndex((l) => l.productId === res.entry.id);
      }
    }

    if (targetIdx < 0) {
      return await this._triggerSilentHandoff(scope, 'item_not_in_cart', { ref: parsed.ref });
    }

    const removedLine = cart.lines[targetIdx];
    const opKey = `remove_${parsed.messageId}`;
    const mutationResult = await this.cartStore.mutate(this.tenantId, customerKey, opKey, (c) => {
      const lines = [...c.lines];
      lines.splice(targetIdx, 1);
      return { write: true, lines, result: { removedLine } };
    });

    const customerMessage = removed(removedLine);
    const guard = verifyCustomerMessage(customerMessage, { allowedCents: [] });
    if (!guard.ok) {
      return await this._triggerSilentHandoff(scope, 'guard_violation', { failures: guard.failures });
    }

    return assertEnvelope(this._buildEnvelope({
      requestId: scope.requestId,
      status: 'found',
      data: { customer_message: customerMessage, removed_line: removedLine },
      validation: { checks: buildChecks({ conversation_allows_auto_reply: true }) },
      provenance: { cart_version: mutationResult.version },
      nextAction: { send_customer_message: true, handoff_to_human: false },
      latencyMs: Date.now() - scope.startMs,
    }));
  }

  async _prepararFinalizacao(scope) {
    const { parsed, customerKey } = scope;
    const cart = await this.cartStore.load(this.tenantId, customerKey);

    if (cart.lines.length === 0) {
      return await this._triggerSilentHandoff(scope, 'empty_cart_checkout', {});
    }

    // Reconsulta mandatória de todos os itens no banco
    const ids = cart.lines.map((l) => l.productId);
    const [rawDocs, stockControl] = await Promise.all([
      this.productSource.getProducts(ids),
      this.productSource.getStockControl(),
    ]);

    const evaluatedMap = new Map();
    const sourceRecords = [];
    for (const raw of rawDocs) {
      if (!raw.exists) return await this._triggerSilentHandoff(scope, 'item_deleted_from_catalog', { id: raw.id });
      const evalRes = evaluateProduct(raw, {
        assertAvailability: this.assertAvailability,
        stockControlEnabled: stockControl.value,
      });
      if (!evalRes.ok) return await this._triggerSilentHandoff(scope, 'item_became_invalid', { id: raw.id, issues: evalRes.issues });
      evaluatedMap.set(String(raw.id), evalRes.product);
      sourceRecords.push(evalRes.source);
    }

    // Checagem de disponibilidade e alterações de preço
    const priceChangesList = [];
    const refreshedLines = [];

    for (const line of cart.lines) {
      const prod = evaluatedMap.get(line.productId);
      if (prod.stock.verified && prod.stock.availableMilli < line.quantityMilli) {
        return await this._triggerSilentHandoff(scope, 'stock_unavailable_on_checkout', {
          product: prod.name,
          requested: line.quantityMilli,
          available: prod.stock.availableMilli,
        });
      }

      if (prod.priceCents !== line.priceCents) {
        priceChangesList.push({
          productId: prod.id,
          name: prod.name,
          presentation: prod.presentation,
          unit: prod.unit,
          oldPriceCents: line.priceCents,
          newPriceCents: prod.priceCents,
        });
      }

      const subtotal = lineSubtotalCents(prod.priceCents, line.quantityMilli);
      refreshedLines.push({
        ...line,
        priceCents: prod.priceCents,
        subtotalCents: subtotal,
      });
    }

    // Se houve mudança de preço e cliente não enviou token de confirmação válido
    if (priceChangesList.length > 0) {
      const expectedToken = Buffer.from(JSON.stringify(priceChangesList)).toString('base64');
      if (parsed.priceChangeToken !== expectedToken) {
        const allowedCents = [];
        for (const c of priceChangesList) {
          allowedCents.push(c.oldPriceCents);
          allowedCents.push(c.newPriceCents);
        }
        const customerMessage = priceChanges(priceChangesList);
        return assertEnvelope(this._buildEnvelope({
          requestId: scope.requestId,
          status: 'found',
          data: {
            customer_message: customerMessage,
            price_changes: priceChangesList,
            confirmation_token: expectedToken,
          },
          validation: { checks: buildChecks({ price_currency_unit_coherent: true }), allowed_cents: allowedCents },
          provenance: { sources: sourceRecords },
          nextAction: { send_customer_message: true, handoff_to_human: false },
          latencyMs: Date.now() - scope.startMs,
        }));
      }
    }

    // Atualiza carrinho com os preços vigentes confirmados
    const opKey = `checkout_${parsed.messageId}`;
    const mutationResult = await this.cartStore.mutate(this.tenantId, customerKey, opKey, (_c) => ({
      write: true,
      lines: refreshedLines,
      preparedAt: new Date().toISOString(),
      result: { lines: refreshedLines },
    }));

    const finalLines = mutationResult.result.lines;
    const subtotalCents = finalLines.reduce((acc, l) => acc + l.subtotalCents, 0);
    const allowedCents = [subtotalCents, ...finalLines.map((l) => l.priceCents), ...finalLines.map((l) => l.subtotalCents)];

    const customerMessage = checkoutSummary(finalLines, subtotalCents);
    const guard = verifyCustomerMessage(customerMessage, { allowedCents });
    if (!guard.ok) {
      return await this._triggerSilentHandoff(scope, 'guard_violation', { failures: guard.failures });
    }

    return assertEnvelope(this._buildEnvelope({
      requestId: scope.requestId,
      status: 'found',
      data: {
        customer_message: customerMessage,
        cart_summary: {
          subtotal_cents: subtotalCents,
          lines: finalLines,
        },
      },
      validation: { checks: buildChecks({ conversation_allows_auto_reply: true }), allowed_cents: allowedCents },
      provenance: { sources: sourceRecords, cart_version: mutationResult.version },
      nextAction: { send_customer_message: true, handoff_to_human: false },
      latencyMs: Date.now() - scope.startMs,
    }));
  }

  async _encaminharAtendente(scope) {
    return await this._triggerSilentHandoff(scope, 'customer_requested_human', {
      note: scope.parsed.note,
    });
  }

  // --- Auxiliares de Handoff Silencioso e Envelope ---

  async _triggerSilentHandoff(scope, reason, metadata = {}) {
    const handoffRecord = {
      requestId: scope.requestId,
      tenantId: this.tenantId,
      customerKey: scope.customerKey,
      customerPhone: scope.parsed?.customerPhone || '',
      request: { message: scope.parsed?.message || null, query: scope.parsed?.query || null, refs: scope.parsed?.refs || null },
      reason,
      metadata,
    };

    try {
      await this.handoffStore.open(handoffRecord);
    } catch {
      // Falha ao abrir handoff não impede o silêncio para o cliente
      require('../shared/logger').error('catalog_handoff_persistence_failed', null, { requestId: scope.requestId, reason });
    }

    return this._buildHandoffEnvelope(scope, reason, metadata);
  }

  _buildHandoffEnvelope(scope, reason, metadata) {
    return assertEnvelope(this._buildEnvelope({
      requestId: scope.requestId,
      status: 'handoff',
      data: {},
      validation: {
        checks: buildChecks({
          conversation_allows_auto_reply: false,
          request_understood: reason !== 'not_understood',
        }),
      },
      provenance: { reason, metadata },
      nextAction: {
        send_customer_message: false,
        handoff_to_human: true,
        pause_automation: true,
      },
      latencyMs: Date.now() - scope.startMs,
    }));
  }

  _buildEnvelope({ requestId, status, data = {}, validation = { checks: [] }, provenance = {}, nextAction = {}, error, latencyMs = 0 }) {
    return {
      request_id: requestId,
      status,
      data,
      validation,
      provenance,
      next_action: nextAction,
      ...(error ? { error } : {}),
      latency_ms: latencyMs,
    };
  }
}

module.exports = { ConfloraAgentService };
