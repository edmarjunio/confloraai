const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

// Existing regression scenarios explicitly opt into their test fixture.
for (const file of fs.readdirSync(path.join(root, 'test'))) {
  if (!file.endsWith('.js')) continue;
  const target = path.join(root, 'test', file);
  const source = fs.readFileSync(target, 'utf8');
  const updated = source.replaceAll('../src/database/firestore.repository', './helpers/repository-fixture');
  if (source !== updated) fs.writeFileSync(target, updated);
}

const target = path.join(root, 'src/database/firestore.repository.js');
let source = fs.readFileSync(target, 'utf8');
function method(name, nextName, replacement) {
  const start = source.indexOf(`  async ${name}(`);
  const end = source.indexOf(`  async ${nextName}(`, start);
  if (start < 0 || end < 0) throw new Error('Repository boundary not found: ' + name);
  source = source.slice(0, start) + replacement.trimEnd() + '\n\n' + source.slice(end);
}
method('getAllProducts', 'getProductById', `
  async getAllProducts() {
    if (this.firestore) {
      const snapshot = await this.firestore.collection('products').get();
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    }
    this.requireTestStorage();
    return [...this.inMemoryProducts.values()];
  }`);
method('getProductById', 'getProductsByIds', `
  async getProductById(productId) {
    if (!productId) return null;
    const id = String(productId).trim();
    if (this.firestore) {
      const document = await this.firestore.collection('products').doc(id).get();
      return document.exists ? { ...document.data(), id: document.id } : null;
    }
    this.requireTestStorage();
    return this.inMemoryProducts.get(id) || null;
  }`);
method('getOrderById', 'saveOrderReceipt', `
  async getOrderById(orderId) {
    const id = String(orderId);
    if (this.firestore) {
      const document = await this.firestore.collection('orders').doc(id).get();
      return document.exists ? { ...document.data(), id: document.id } : null;
    }
    this.requireTestStorage();
    return this.inMemoryOrders.get(id) || null;
  }`);
method('saveOrderReceipt', 'findPendingPixOrderByPhone', `
  async saveOrderReceipt(orderId, receiptText) {
    const id = String(orderId || '').trim();
    if (!id || !String(receiptText || '').trim()) throw new Error('Pedido e recibo são obrigatórios.');
    const order = await this.getOrderById(id);
    if (!order) throw new Error('Pedido não encontrado.');
    if (this.firestore) await this.firestore.collection('orders').doc(id).update({ receiptText });
    else { this.requireTestStorage(); this.inMemoryOrders.set(id, { ...order, receiptText }); }
    return { ...order, receiptText };
  }`);
method('getSalesOrders', 'getAllOrders', `
  async getSalesOrders() {
    if (!this.firestore) { this.requireTestStorage(); return [...this.inMemoryOrders.values()]; }
    const orders = [];
    let cursor;
    do {
      let query = this.firestore.collection('orders').select('status', 'items').orderBy('__name__').limit(500);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      orders.push(...page.docs.map(doc => doc.data()));
      if (page.size < 500) break;
      cursor = page.docs[page.docs.length - 1];
    } while (cursor);
    return orders;
  }`);
method('getAllOrders', 'updateOrderStatus', `
  async getAllOrders(limit = 50) {
    const size = Math.min(10000, Math.max(1, Math.floor(Number(limit) || 50)));
    if (this.firestore) {
      const snapshot = await this.firestore.collection('orders').orderBy('createdAt', 'desc').limit(size).get();
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    }
    this.requireTestStorage();
    return [...this.inMemoryOrders.values()].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, size);
  }`);
// Never continue into process-local storage after a failed Firestore operation.
source = source.replace(/catch \((err|error)\) \{/g, (_match, name) =>
  `catch (${name}) {\n        if (!this.isInMemory) throw ${name};`);
source = source.replace(/\s*if \(!admins.length\) \{\s*admins = \[\{ id: 'usr-edmar', name: 'Edmar Júnio \(Admin\)' \}\];\s*\}/g, '');
source = source.replace(/\s*if \(adminUsers.length === 0\) \{\s*adminUsers = \[\{ id: 'usr-edmar', name: 'Edmar Júnio \(Admin\)', role: 'ADMIN' \}\];\s*\}/g, '');
source = source.replace(/\s*if \(!administrators.length\) administrators = \[\{ id: 'usr-edmar', name: 'Edmar Júnio \(Admin\)' \}\];/g, '');
const marker = '  // --- Funções REST';
source = source.replace(marker, `  requireTestStorage() {
    if (process.env.NODE_ENV !== 'test' || !this.isInMemory || this.firestore) {
      throw Object.assign(new Error('Firestore indisponível. Operação não confirmada.'), { status: 503 });
    }
  }

${marker}`);
fs.writeFileSync(target, source);
