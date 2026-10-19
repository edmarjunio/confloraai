'use strict';

/** Acesso de leitura ao Firestore (Admin/@google-cloud). Somente leitura: nenhuma escrita em `products`. */
class FirestoreProductSource {
  /**
   * @param {import('@google-cloud/firestore').Firestore} db
   * @param {{productsCollection?:string, synonymsCollection?:string, settingsCollection?:string}} [names]
   */
  constructor(db, names = {}) {
    if (!db) throw new Error('FirestoreProductSource requer uma instância do Firestore.');
    this.db = db;
    this.productsCollection = names.productsCollection || 'products';
    this.synonymsCollection = names.synonymsCollection || 'agent_synonyms';
    this.settingsCollection = names.settingsCollection || 'store_settings';
  }

  /** Projeção só com campos de identificação (nome, categoria, status). Nenhum preço/estoque entra no índice. */
  async listIdentity() {
    const fields = [
      'name', 'descricao', 'DESCRIÇÃO', 'canonicalName',
      'category', 'categoria', 'CATEGORIA', 'subcategory', 'subcategoria', 'SUBCATEGORIA',
      'status', 'STATUS',
    ];
    const snapshot = await this.db.collection(this.productsCollection).select(...fields).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  }

  /** Leitura atual (uma chamada) dos documentos completos por ID, com readTime/updateTime do servidor. */
  async getProducts(ids) {
    if (!ids.length) return [];
    const refs = ids.map((id) => this.db.collection(this.productsCollection).doc(id));
    const snaps = await this.db.getAll(...refs);
    return snaps.map((snap) => ({
      id: snap.id,
      exists: snap.exists,
      data: snap.exists ? snap.data() : null,
      readTime: snap.readTime,
      updateTime: snap.updateTime,
    }));
  }

  /** `store_settings/inventory.stockControlEnabled`; qualquer valor não booleano => desconhecido (null). */
  async getStockControl() {
    const snap = await this.db.collection(this.settingsCollection).doc('inventory').get();
    const value = snap.exists ? snap.data().stockControlEnabled : undefined;
    return { value: typeof value === 'boolean' ? value : null, readTime: snap.readTime };
  }

  /** Sinônimos aprovados por pessoa: { term, productIds[], approved:true }. `tagsAi` NÃO é usado (gerado por IA). */
  async listApprovedSynonyms() {
    const snapshot = await this.db.collection(this.synonymsCollection).where('approved', '==', true).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
}

module.exports = { FirestoreProductSource };
