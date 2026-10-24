'use strict';
const { sha256 } = require('./util');

const MAX_REMEMBERED_OPS = 30;

/** ID estável e sem PII: hash do telefone (E.164 sem símbolos) dentro do escopo da empresa. */
function customerKeyFor(tenantId, phoneDigits) {
  return sha256(`${tenantId}:${phoneDigits}`).slice(0, 32);
}

function scopedId(tenantId, customerKey) {
  return `${tenantId}__${customerKey}`;
}

/**
 * Carrinho do atendimento. Coleção própria e separada (piloto: `agent_pilot_carts`).
 * NÃO toca em products, orders, stock_movements nem reservas: nada de baixa de estoque, venda, Pix ou entrega.
 */
class CartStore {
  constructor(db, { collection = 'agent_pilot_carts', now = () => new Date() } = {}) {
    this.db = db;
    this.collection = collection;
    this.now = now;
  }

  ref(tenantId, customerKey) {
    return this.db.collection(this.collection).doc(scopedId(tenantId, customerKey));
  }

  emptyCart(tenantId, customerKey) {
    const iso = this.now().toISOString();
    return { tenantId, customerKey, pilot: true, version: 0, createdAt: iso, updatedAt: iso, lines: [], ops: {} };
  }

  assertScope(data, tenantId, customerKey) {
    if (data.tenantId !== tenantId || data.customerKey !== customerKey) {
      const error = new Error('Violação de isolamento do carrinho.');
      error.code = 'CART_ISOLATION';
      throw error;
    }
  }

  async load(tenantId, customerKey) {
    const snap = await this.ref(tenantId, customerKey).get();
    if (!snap.exists) return this.emptyCart(tenantId, customerKey);
    const data = snap.data();
    this.assertScope(data, tenantId, customerKey);
    return data;
  }

  /**
   * Alteração atômica e idempotente. `apply(cart)` deve ser PURA (a transação pode ser repetida) e devolver
   * { write: boolean, lines?: object[], preparedAt?: string, result: object (JSON) }.
   * Se `opKey` já foi gravada, devolve o resultado guardado sem alterar nada.
   */
  async mutate(tenantId, customerKey, opKey, apply) {
    const ref = this.ref(tenantId, customerKey);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cart = snap.exists ? snap.data() : this.emptyCart(tenantId, customerKey);
      if (snap.exists) this.assertScope(cart, tenantId, customerKey);
      const remembered = cart.ops?.[opKey];
      if (remembered) return { replayed: true, result: remembered.result };
      const outcome = apply(JSON.parse(JSON.stringify(cart)));
      if (!outcome.write) return { replayed: false, result: outcome.result, written: false };
      const now = this.now().toISOString();
      const ops = { ...(cart.ops ?? {}), [opKey]: { at: now, result: outcome.result } };
      const keep = Object.entries(ops).sort((a, b) => (a[1].at < b[1].at ? 1 : -1)).slice(0, MAX_REMEMBERED_OPS);
      tx.set(ref, {
        ...cart,
        lines: outcome.lines,
        ...(outcome.preparedAt ? { preparedAt: outcome.preparedAt } : {}),
        version: (cart.version ?? 0) + 1,
        updatedAt: now,
        ops: Object.fromEntries(keep),
      });
      return { replayed: false, result: outcome.result, written: true, version: (cart.version ?? 0) + 1 };
    });
  }
}

/** Fila de atendimento humano + estado da conversa (pausa de automação). Visível à equipe pela rota administrativa. */
class HandoffStore {
  constructor(db, { handoffs = 'agent_handoffs', conversations = 'agent_conversations', now = () => new Date() } = {}) {
    this.db = db;
    this.handoffs = handoffs;
    this.conversations = conversations;
    this.now = now;
  }

  conversationRef(tenantId, customerKey) {
    return this.db.collection(this.conversations).doc(scopedId(tenantId, customerKey));
  }

  async getConversation(tenantId, customerKey) {
    const snap = await this.conversationRef(tenantId, customerKey).get();
    if (!snap.exists) return { automation: 'active' };
    const data = snap.data();
    if (data.tenantId !== tenantId || data.customerKey !== customerKey) {
      const error = new Error('Violação de isolamento da conversa.');
      error.code = 'CONVERSATION_ISOLATION';
      throw error;
    }
    return data;
  }

  /** Grava o encaminhamento e pausa a automação no mesmo lote atômico. */
  async open(record) {
    const conversationRef = this.conversationRef(record.tenantId, record.customerKey);
    return this.db.runTransaction(async tx => {
      const conversation = await tx.get(conversationRef);
      const state = conversation.exists ? conversation.data() : {};
      if (state.tenantId && (state.tenantId !== record.tenantId || state.customerKey !== record.customerKey)) throw new Error('CONVERSATION_ISOLATION');
      if (state.automation === 'paused' && state.handoffId) return { id: state.handoffId, status: 'open' };
      const iso = this.now().toISOString();
      const id = `hf_${record.requestId}`;
      const handoff = { ...JSON.parse(JSON.stringify(record)), id, status: 'open', createdAt: iso, cartPreserved: true };
      tx.set(this.db.collection(this.handoffs).doc(id), handoff);
      tx.set(conversationRef, {
        ...state, tenantId: record.tenantId, customerKey: record.customerKey, automation: 'paused',
        pausedAt: iso, reason: record.reason, handoffId: id, updatedAt: iso,
      });
      return handoff;
    });
  }

  async rememberProducts(tenantId, customerKey, products) {
    const ref = this.conversationRef(tenantId, customerKey);
    return this.db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const state = snap.exists ? snap.data() : { tenantId, customerKey, automation: 'active' };
      if (state.tenantId !== tenantId || state.customerKey !== customerKey) throw new Error('CONVERSATION_ISOLATION');
      if (state.automation === 'paused') return false;
      tx.set(ref, { ...state, presentedProductIds: products.map(p => p.id).slice(0, 3), presentedAt: this.now().toISOString() });
      return true;
    });
  }

  async listOpen(tenantId, limit = 100) {
    const snap = await this.db.collection(this.handoffs).where('status', '==', 'open').limit(500).get();
    return snap.docs.map((d) => d.data()).filter((h) => h.tenantId === tenantId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)).slice(0, limit);
  }

  async get(handoffId) {
    const snap = await this.db.collection(this.handoffs).doc(handoffId).get();
    return snap.exists ? snap.data() : null;
  }

  /** Retomada autorizada: só atua em handoff aberto da mesma empresa. */
  async resume(tenantId, handoffId, actor) {
    const ref = this.db.collection(this.handoffs).doc(handoffId);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { ok: false, code: 'not_found' };
      const handoff = snap.data();
      if (handoff.tenantId !== tenantId) return { ok: false, code: 'not_found' };
      if (handoff.status !== 'open') return { ok: false, code: 'already_resolved' };
      const conversationRef = this.conversationRef(tenantId, handoff.customerKey);
      const conversation = await tx.get(conversationRef);
      if (conversation.data()?.handoffId !== handoffId) return { ok: false, code: 'superseded_handoff' };
      const iso = this.now().toISOString();
      tx.update(ref, { status: 'resumed', resumedAt: iso, resumedBy: { id: actor.id, role: actor.role } });
      tx.set(this.conversationRef(tenantId, handoff.customerKey), {
        tenantId, customerKey: handoff.customerKey, automation: 'active', resumedAt: iso,
        resumedBy: actor.id, handoffId, updatedAt: iso, version: Number(conversation.data()?.version || 0) + 1,
      });
      return { ok: true, handoff: { ...handoff, status: 'resumed' } };
    });
  }

  /**
   * Assumir atendimento por operador humano com concorrência e versionamento atômicos.
   * Se outro operador tentar assumir simultaneamente, o backend resolve com conflito 409.
   */
  async takeover(tenantId, customerKey, actor, expectedVersion = null) {
    const conversationRef = this.conversationRef(tenantId, customerKey);
    return this.db.runTransaction(async tx => {
      const snap = await tx.get(conversationRef);
      const current = snap.exists ? snap.data() : { tenantId, customerKey, automation: 'active', version: 0 };
      if (current.tenantId !== tenantId || current.customerKey !== customerKey) throw new Error('CONVERSATION_ISOLATION');

      const currentVersion = Number(current.version || 0);
      if (expectedVersion !== null && expectedVersion !== undefined && expectedVersion !== currentVersion) {
        return { ok: false, code: 'CONCURRENCY_CONFLICT', message: 'Atendimento já alterado por outro operador.', currentOperator: current.assignedTo || null };
      }

      if (current.automation === 'paused' && current.assignedTo && current.assignedTo.id !== actor.id) {
        return { ok: false, code: 'ALREADY_ASSIGNED', message: `Atendimento sob responsabilidade de ${current.assignedTo.name || current.assignedTo.id}.`, currentOperator: current.assignedTo };
      }

      const iso = this.now().toISOString();
      const newVersion = currentVersion + 1;
      const updated = {
        ...current,
        tenantId,
        customerKey,
        automation: 'paused',
        pausedAt: current.pausedAt || iso,
        reason: 'human_takeover',
        assignedTo: { id: actor.id, name: actor.name || actor.id, role: actor.role, assignedAt: iso },
        version: newVersion,
        updatedAt: iso,
      };

      tx.set(conversationRef, updated);
      return { ok: true, conversation: updated, version: newVersion };
    });
  }
}

module.exports = { CartStore, HandoffStore, customerKeyFor, scopedId, MAX_REMEMBERED_OPS };
