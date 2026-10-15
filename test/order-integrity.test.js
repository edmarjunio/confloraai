process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FirestoreRepository } = require('../src/database/firestore.repository');

// Double transacional: publica escritas só no commit e proíbe leitura após escrita.
// Não substitui a homologação com o emulador/Firestore real.
function transactionalStore(initial) {
  let documents = new Map(Object.entries(initial));
  let queue = Promise.resolve();
  let sequence = 0;
  const snapshot = (ref) => ({ exists: documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)) });
  const store = {
    failCommit: false,
    read: (path) => documents.get(path),
    collection: (name) => ({
      doc: (id = String(++sequence)) => {
        const ref = { id, path: `${name}/${id}` };
        return { ...ref, get: async () => snapshot(ref) };
      },
    }),
    runTransaction: (callback) => {
      const operation = queue.then(async () => {
        const writes = [];
        const result = await callback({
          get: async (ref) => {
            assert.equal(writes.length, 0, 'Firestore requires all reads before writes');
            return snapshot(ref);
          },
          update: (ref, value) => writes.push([ref.path, value, true]),
          set: (ref, value) => writes.push([ref.path, value, false]),
        });
        if (store.failCommit) {
          throw new Error('Commit indisponível');
        }
        const next = new Map(documents);
        for (const [path, value, merge] of writes) {
          next.set(path, structuredClone({ ...(merge ? next.get(path) : {}), ...value }));
        }
        documents = next;
        return result;
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
  return store;
}

function setup(mode, overrides = {}) {
  const order = { id: 'sale', status: 'PENDING', paymentMethod: 'PIX', total: 20,
    items: [{ productId: 'plant', name: 'Muda', price: 10, quantity: 2 }], ...overrides };
  const product = { id: 'plant', name: 'Muda', stockQuantity: 10 };
  const store = mode === 'transaction' ? transactionalStore({
    'orders/sale': order, 'products/plant': product,
    'store_settings/inventory': { stockControlEnabled: true },
  }) : null;
  const repo = new FirestoreRepository({ isInMemory: true, firestoreInstance: store });
  repo.inMemoryOrders.set(order.id, structuredClone(order));
  repo.inMemoryProducts.set(product.id, structuredClone(product));
  return { repo, store,
    order: () => store ? store.read('orders/sale') : repo.inMemoryOrders.get('sale'),
    stock: () => store ? store.read('products/plant').stockQuantity : repo.inMemoryProducts.get('plant').stockQuantity };
}

const verification = { verifiedVia: 'MERCADO_PAGO_WEBHOOK', paymentTransactionId: '12345', paymentAmount: 20 };
for (const mode of ['memory', 'transaction']) {
  test(`${mode}: repeated concurrent confirmations deduct once`, async () => {
    const state = setup(mode);
    const results = await Promise.all(Array.from({ length: 5 }, () => state.repo.confirmOrderPayment('sale', verification)));
    assert.equal(state.stock(), 8);
    assert.equal(state.order().stockDeducted, true);
    assert.equal(results.filter((result) => !result.alreadyConfirmed).length, 1);
  });
  test(`${mode}: legacy deduction is preserved at payment confirmation`, async () => {
    const state = setup(mode, { stockDeducted: true });
    await state.repo.confirmOrderPayment('sale', verification);
    assert.equal(state.stock(), 10);
    assert.equal(state.order().status, 'CONFIRMED');
  });
  test(`${mode}: cancelled orders cannot be confirmed`, async () => {
    const state = setup(mode);
    await state.repo.cancelOrder('sale');
    await assert.rejects(state.repo.confirmOrderPayment('sale', verification));
    assert.equal(state.stock(), 10);
    assert.equal(state.order().status, 'CANCELLED');
  });
  test(`${mode}: cancellation cannot hide an approved payment`, async () => {
    const state = setup(mode);
    await state.repo.confirmOrderPayment('sale', verification);
    await assert.rejects(state.repo.cancelOrder('sale'));
    await state.repo.updateOrderStatus('sale', 'DELIVERED');
    await state.repo.confirmOrderPayment('sale', verification);
    assert.equal(state.order().status, 'DELIVERED');
    assert.equal(state.stock(), 8);
  });
  test(`${mode}: admin cannot bypass PIX verification or delivery order`, async () => {
    const state = setup(mode);
    await assert.rejects(state.repo.updateOrderStatus('sale', 'CONFIRMED'));
    await assert.rejects(state.repo.updateOrderStatus('sale', 'DELIVERED'));
    assert.equal(state.order().status, 'PENDING');
    assert.equal(state.stock(), 10);
  });
  test(`${mode}: duplicate product rows are summed before stock validation`, async () => {
    const state = setup(mode, { items: [{ productId: 'plant', quantity: 6 }, { productId: 'plant', quantity: 5 }] });
    await assert.rejects(state.repo.confirmOrderPayment('sale', verification));
    assert.equal(state.stock(), 10);
    assert.equal(state.order().status, 'PENDING');
  });
  test(`${mode}: invalid quantity or missing product leaves the entire batch unchanged`, async () => {
    for (const item of [{ productId: 'plant', quantity: -1 }, { productId: 'missing', name: 'Muda', quantity: 1 }]) {
      const state = setup(mode, { items: [{ productId: 'plant', quantity: 2 }, item] });
      await assert.rejects(state.repo.confirmOrderPayment('sale', verification));
      assert.equal(state.stock(), 10);
      assert.equal(state.order().status, 'PENDING');
    }
  });
  test(`${mode}: cash confirmation through admin also deducts once`, async () => {
    const state = setup(mode, { paymentMethod: 'DINHEIRO' });
    await state.repo.updateOrderStatus('sale', 'CONFIRMED');
    await state.repo.updateOrderStatus('sale', 'CONFIRMED');
    assert.equal(state.stock(), 8);
  });
}

test('failed commit leaves stock and payment unchanged and allows a retry', async () => {
  const state = setup('transaction');
  state.store.failCommit = true;
  await assert.rejects(state.repo.confirmOrderPayment('sale', verification));
  assert.equal(state.stock(), 10);
  assert.equal(state.order().status, 'PENDING');
  state.store.failCommit = false;
  await state.repo.confirmOrderPayment('sale', verification);
  assert.equal(state.stock(), 8);
});

test('cash PDV creation remains pending if stock confirmation fails', async () => {
  const { repo } = setup('memory');
  await assert.rejects(repo.createManualOrder({ orderId: 'pdv', paymentMethod: 'DINHEIRO',
    items: [{ productId: 'plant', quantity: 11, price: 10 }] }));
  assert.equal(repo.inMemoryOrders.get('pdv').status, 'PENDING');
  assert.equal(repo.inMemoryProducts.get('plant').stockQuantity, 10);
});
