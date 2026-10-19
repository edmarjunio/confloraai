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
    const iso = this.now().toISOString();
    const id = `hf_${record.requestId}`;
    const handoff = { ...record, id, status: 'open', createdAt: iso, cartPreserved: true };
    const batch = this.db.batch();
    batch.set(this.db.collection(this.handoffs).doc(id), handoff);
    batch.set(this.conversationRef(record.tenantId, record.customerKey), {
      tenantId: record.tenantId, customerKey: record.customerKey, automation: 'paused',
      pausedAt: iso, reason: record.reason, handoffId: id, updatedAt: iso,
    });
    await batch.commit();
    return handoff;
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
      const iso = this.now().toISOString();
      tx.update(ref, { status: 'resumed', resumedAt: iso, resumedBy: { id: actor.id, role: actor.role } });
      tx.set(this.conversationRef(tenantId, handoff.customerKey), {
        tenantId, customerKey: handoff.customerKey, automation: 'active', resumedAt: iso,
        resumedBy: actor.id, handoffId, updatedAt: iso,
      });
      return { ok: true, handoff: { ...handoff, status: 'resumed' } };
    });
  }
}

module.exports = { CartStore, HandoffStore, customerKeyFor, scopedId, MAX_REMEMBERED_OPS };
