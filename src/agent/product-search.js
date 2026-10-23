'use strict';
const { normalizeName, nameTokens, tokenKey, singularToken } = require('./util');
const { firstText, FIELD_MAP } = require('./product-contract');
const { interpretTraits, satisfiesTraits } = require('./plant-search');

function rawStatus(data) {
  const value = firstText(data, FIELD_MAP.status);
  const status = value ? value.toUpperCase() : 'ATIVO';
  return status === 'ACTIVE' ? 'ATIVO' : status === 'INACTIVE' ? 'INATIVO' : status;
}

function editDistanceAtMostOne(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; let j = 0; let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (a.length < b.length) j += 1;
    else { i += 1; j += 1; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function categoryKey(value) {
  return value ? nameTokens(value).join(' ') : '';
}

/**
 * Índice de IDENTIFICAÇÃO (nome/categoria/status/sinônimos). Nunca contém preço ou estoque.
 * Serve apenas para localizar IDs; todo dado comercial é relido do Firestore a cada resposta.
 * Expira em `ttlMs`; se a atualização falhar, não há fallback para um índice vencido.
 */
class ProductIndex {
  constructor({ source, now = () => Date.now(), ttlMs = 0, minRefreshGapMs = 0, maxEntries = 20_000 }) {
    this.source = source;
    this.now = now;
    this.ttlMs = ttlMs;
    this.minRefreshGapMs = minRefreshGapMs;
    this.maxEntries = maxEntries;
    this.loadedAt = 0;
    this.entries = [];
    this.byId = new Map();
    this.byNorm = new Map();
    this.byKey = new Map();
    this.synonyms = new Map();
    this.ignoredSynonyms = [];
    this.pending = null;
    this.generation = 0;
  }

  invalidate() {
    this.loadedAt = 0;
    this.generation++;
  }

  isFresh() {
    return this.loadedAt > 0 && this.now() - this.loadedAt < this.ttlMs;
  }

  async ensureFresh() {
    if (this.isFresh()) return;
    await this.refresh({ force: true });
  }

  /** Atualização única compartilhada; erros propagam (sem servir índice vencido). */
  async refresh({ force = false } = {}) {
    if (!force && this.loadedAt > 0 && this.now() - this.loadedAt < this.minRefreshGapMs) return;
    if (!this.pending) {
      this.pending = this.load().finally(() => { this.pending = null; });
    }
    await this.pending;
  }

  async load() {
    const generation = this.generation;
    const [docs, synonymDocs] = await Promise.all([this.source.listIdentity(), this.source.listApprovedSynonyms()]);
    if (docs.length > this.maxEntries) throw new Error('Catálogo acima do limite do índice.');
    const entries = [];
    for (const doc of docs) {
      const name = firstText(doc.data, FIELD_MAP.name);
      if (!name) continue;
      entries.push({
        id: String(doc.id),
        name,
        norm: normalizeName(name),
        key: tokenKey(name),
        tokens: [...new Set(nameTokens(name))],
        botanical: doc.data.botanical || null,
        status: rawStatus(doc.data),
        category: categoryKey(firstText(doc.data, FIELD_MAP.category)),
        subcategory: categoryKey(firstText(doc.data, FIELD_MAP.subcategory)),
      });
    }
    const byId = new Map(entries.map((e) => [e.id, e]));
    const byNorm = new Map();
    const byKey = new Map();
    for (const entry of entries) {
      if (!byNorm.has(entry.norm)) byNorm.set(entry.norm, []);
      byNorm.get(entry.norm).push(entry);
      if (!byKey.has(entry.key)) byKey.set(entry.key, []);
      byKey.get(entry.key).push(entry);
    }
    const synonyms = new Map();
    const ignored = [];
    for (const syn of synonymDocs) {
      const term = normalizeName(syn.term);
      const ids = Array.isArray(syn.productIds) ? syn.productIds.map(String).filter((id) => byId.has(id)) : [];
      if (syn.approved !== true || !term || ids.length === 0) { ignored.push(syn.id ?? syn.term); continue; }
      synonyms.set(term, new Set([...(synonyms.get(term) ?? []), ...ids]));
    }
    if (generation !== this.generation) throw new Error('Catalog changed during index refresh.');
    Object.assign(this, { entries, byId, byNorm, byKey, synonyms, ignoredSynonyms: ignored, loadedAt: this.now() });
  }

  /**
   * Resolve um pedido de produto ÚNICO. Ordem: ID exato -> nome normalizado exato (ou mesmas palavras em outra ordem)
   * -> sinônimo aprovado -> combinação de termos (apenas gera candidatos; nunca decide).
   * @returns {{outcome:'found'|'ambiguous'|'not_found', tier?:string, entry?:object, candidates?:object[], reason?:string}}
   */
  resolve(query) {
    const text = typeof query === 'string' ? query.trim() : '';
    const norm = normalizeName(text);
    if (!norm) return { outcome: 'not_found', reason: 'empty_query' };

    const byId = this.byId.get(text);
    if (byId) return { outcome: 'found', tier: 'id', entry: byId };

    const unique = (list) => [...new Map(list.map((e) => [e.id, e])).values()];
    const exact = unique([...(this.byNorm.get(norm) ?? []), ...(this.byKey.get(tokenKey(text)) ?? [])]);
    const active = exact.filter((e) => e.status !== 'INATIVO');
    if (active.length === 1) return { outcome: 'found', tier: 'name', entry: active[0] };
    if (active.length > 1) return { outcome: 'ambiguous', reason: 'duplicate_name', candidates: active.slice(0, 5) };

    const synonymIds = this.synonyms.get(norm);
    if (synonymIds) {
      const list = [...synonymIds].map((id) => this.byId.get(id)).filter((e) => e && e.status !== 'INATIVO');
      if (list.length === 1) return { outcome: 'found', tier: 'synonym', entry: list[0] };
      if (list.length > 1) return { outcome: 'ambiguous', reason: 'synonym_multiple', candidates: list.slice(0, 5) };
    }

    if (exact.length > 0) return { outcome: 'found', tier: 'name', entry: exact[0], inactiveOnly: true };

    const queryTokens = [...new Set(nameTokens(text))];
    const partial = this.entries.filter((e) => e.status !== 'INATIVO' && queryTokens.every((t) => e.tokens.includes(t)));
    if (partial.length > 0) return { outcome: 'ambiguous', reason: 'partial_match', candidates: partial.slice(0, 5) };

    const typo = this.entries.filter((e) => e.status !== 'INATIVO'
      && queryTokens.every((t) => e.tokens.some((et) => et === t || (t.length >= 5 && editDistanceAtMostOne(singularToken(t), et)))));
    if (typo.length > 0) return { outcome: 'not_found', reason: 'possible_typo', candidates: typo.slice(0, 5) };
    return { outcome: 'not_found', reason: 'no_match' };
  }

  /** Lista explícita (cliente pediu categoria/opções): filtros respeitados, ordem fixa por nome e ID. */
  match({ category = '', query = '' } = {}) {
    const cat = categoryKey(category);
    const interpreted = interpretTraits(query);
    if (interpreted.constraints.length) {
      if (interpreted.unsupported || !interpreted.constraints.length) return [];
      return this.entries.filter(e => e.status !== 'INATIVO' && e.status !== 'INACTIVE')
        .filter(e => !cat || e.category === cat || e.subcategory === cat)
        .filter(e => satisfiesTraits(e, interpreted.constraints))
        .sort((a, b) => a.id.localeCompare(b.id));
    }
    const tokens = [...new Set(nameTokens(query))];
    if (!cat && tokens.length === 0) return [];
    return this.entries
      .filter((e) => e.status !== 'INATIVO')
      .filter((e) => !cat || e.category === cat || e.subcategory === cat)
      .filter((e) => tokens.every((t) => e.tokens.includes(t)))
      .sort((a, b) => (a.norm < b.norm ? -1 : a.norm > b.norm ? 1 : a.id < b.id ? -1 : 1));
  }

  findCategory({ category = '', limit = 10 } = {}) {
    const all = this.match({ category });
    return {
      totalFound: all.length,
      items: all.slice(0, limit),
    };
  }
}

module.exports = { ProductIndex, editDistanceAtMostOne };
