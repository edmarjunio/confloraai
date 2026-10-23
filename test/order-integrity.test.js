process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FirestoreRepository } = require('./helpers/repository-fixture');

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
          create: (ref, value) => { assert.equal(documents.has(ref.path), false); writes.push([ref.path, value, false]); },
        });
        if (store.failCommit) {throw new Error('Commit indisponível');}
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
  if (order.paymentMethod === 'PIX' && !order.pixData) order.pixData = { txid: 'A'.repeat(32) };
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

const verification = { verifiedVia: 'SICREDI_PIX_WEBHOOK', pixTxid: 'A'.repeat(32), paymentTransactionId: 'E' + '1'.repeat(31), paymentAmount: 20 };
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
  test(`${mode}: cancellation preserves received installments for reconciliation`, async () => {
    const state = setup(mode, { status: 'AWAITING_PIX', paymentParts: [
      { method: 'PIX', amount: 12 },
      { method: 'DINHEIRO', amount: 5.35, status: 'RECEIVED_AT_CASHIER' },
      { method: 'CREDITO', amount: 2.65, status: 'RECEIVED_AT_CASHIER' },
    ] });
    if (state.store) {
      state.store.failCommit = true;
      await assert.rejects(state.repo.cancelOrder('sale', 'Falha no agendamento'));
      assert.equal(state.order().status, 'AWAITING_PIX');
      assert.equal(state.order().requiresRefund, undefined);
      state.store.failCommit = false;
    }
    await state.repo.cancelOrder('sale', 'Falha no agendamento');
    await state.repo.cancelOrder('sale', 'Repetição');
    assert.equal(state.order().status, 'CANCELLED');
    assert.equal(state.order().paymentStatus, 'PARTIAL_RECONCILIATION');
    assert.equal(state.order().requiresRefund, true);
    assert.equal(state.order().refundDue, 8);
    assert.equal(state.stock(), 10);
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

test('web Pix reservation is idempotent, protects stock until payment, then deducts exactly once with cashier audit', async () => {
  const repository = new FirestoreRepository({ isInMemory: true });
  await repository.saveInventorySettings({ stockControlEnabled: true });
  repository.inMemoryProducts.set('plant', { id: 'plant', name: 'Muda', price: 10, stockQuantity: 3, reservedQuantity: 0 });
  const order = await repository.createDirectOrder({
    id: 'web-pix-reserved', source: 'WEB_CATALOG', status: 'AWAITING_PIX', paymentMethod: 'PIX',
    total: 20, pixData: { txid: '0123456789ABCDEF0123456789ABCDEF' },
    items: [{ productId: 'plant', name: 'Muda', price: 10, quantity: 2 }],
  }, { requirePersistence: false, reserveInventory: true });
  await repository.createDirectOrder({ ...order }, { reserveInventory: true });
  assert.equal(order.inventoryReserved, true);
  assert.equal(repository.inMemoryProducts.get('plant').reservedQuantity, 2);
  await assert.rejects(repository.createDirectOrder({
    id: 'web-pix-overbook', source: 'WEB_CATALOG', status: 'AWAITING_PIX', paymentMethod: 'PIX', total: 100,
    items: [{ productId: 'plant', name: 'Muda', price: 10, quantity: 9 }],
  }, { reserveInventory: true }), /Estoque disponível insuficiente/);
  // Existing reservations remain protected after switching to free sales.
  await repository.saveInventorySettings({ stockControlEnabled: false });
  await repository.createDirectOrder({
    id: 'cash-order-competing', source: 'WEB_CATALOG', status: 'AWAITING_CASHIER', paymentMethod: 'DINHEIRO', total: 20,
    items: [{ productId: 'plant', name: 'Muda', price: 10, quantity: 2 }],
  });
  await assert.rejects(repository.confirmOrderPayment('cash-order-competing', {
    verifiedVia: 'CAIXA_MANUAL', paymentMethod: 'DINHEIRO', paymentAmount: 20,
    receivedBy: { id: 'cashier-1', name: 'Caixa', role: 'CAIXA' },
  }), /Estoque disponível insuficiente/);
  assert.equal(repository.inMemoryProducts.get('plant').stockQuantity, 3);
  assert.equal(repository.inMemoryProducts.get('plant').reservedQuantity, 2);

  const receivedBy = { id: 'cashier-1', name: 'Caixa', role: 'CAIXA' };
  const verified = await repository.confirmOrderPayment(order.id, {
    verifiedVia: 'MANUAL_CAIXA_PIX', paymentTransactionId: 'MANUAL-web-pix-reserved',
    paymentAmount: 20, pixTxid: order.pixData.txid, receivedBy,
    manualPixProofSeen: true, manualPixNote: 'Comprovante conferido no caixa',
  });
  const duplicate = await repository.confirmOrderPayment(order.id, {
    verifiedVia: 'MANUAL_CAIXA_PIX', paymentTransactionId: 'MANUAL-web-pix-reserved',
    paymentAmount: 20, pixTxid: order.pixData.txid, receivedBy,
    manualPixProofSeen: true, manualPixNote: 'Comprovante conferido no caixa',
  });
  assert.equal(verified.paymentStatus, 'APPROVED');
  assert.equal(verified.manualPixConfirmedBy.id, 'cashier-1');
  assert.equal(duplicate.alreadyConfirmed, true);
  assert.equal(repository.inMemoryProducts.get('plant').stockQuantity, 1);
  assert.equal(repository.inMemoryProducts.get('plant').reservedQuantity, 0);
});

test('cancelling an unpaid web Pix releases its stock reservation without changing physical stock', async () => {
  const repository = new FirestoreRepository({ isInMemory: true });
  await repository.saveInventorySettings({ stockControlEnabled: false });
  repository.inMemoryProducts.set('plant', { id: 'plant', name: 'Muda', stockQuantity: 10, reservedQuantity: 2 });
  await repository.createDirectOrder({
    id: 'web-pix-expired', source: 'WEB_CATALOG', status: 'AWAITING_PIX', paymentMethod: 'PIX', total: 20,
    items: [{ productId: 'plant', name: 'Muda', price: 10, quantity: 2 }],
    inventoryReserved: true, reservedItems: [{ productId: 'plant', quantity: 2 }],
  });
  await repository.cancelOrder('web-pix-expired', 'Prazo Pix expirado');
  assert.equal(repository.inMemoryOrders.get('web-pix-expired').status, 'CANCELLED');
  assert.equal(repository.inMemoryProducts.get('plant').stockQuantity, 10);
  assert.equal(repository.inMemoryProducts.get('plant').reservedQuantity, 0);
});

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

test('Firestore transaction: command reservation and settlement roll back together on failed commit', async () => {
  const { PdvRepository } = require('../src/orders/pdv.repository');
  const state = setup('transaction', { source: 'PDV', status: 'AWAITING_CONFIRMATION', paymentMethod: 'DINHEIRO' });
  const pdv = new PdvRepository(state.repo); const cashier = { id: 'cashier', name: 'Caixa', role: 'CAIXA' };
  await require('../src/orders/cashier-sessions').open(pdv, cashier, { requestId: require('node:crypto').randomUUID(), openingFloat: 0 });
  state.store.failCommit = true;
  await assert.rejects(pdv.advanceToPayment('sale', cashier), /Commit/);
  assert.equal(state.order().status, 'AWAITING_CONFIRMATION');
  assert.equal(state.store.read('products/plant').reservedQuantity, undefined);
  state.store.failCommit = false; await pdv.advanceToPayment('sale', cashier);
  assert.equal(state.stock(), 10); assert.equal(state.store.read('products/plant').reservedQuantity, 2);
  state.store.failCommit = true; await assert.rejects(pdv.receive('sale', cashier), /Commit/);
  assert.equal(state.order().status, 'AWAITING_PAYMENT'); assert.equal(state.stock(), 10);
  assert.equal(state.store.read('products/plant').reservedQuantity, 2);
  state.store.failCommit = false; await pdv.receive('sale', cashier);
  assert.equal(state.order().paymentStatus, 'APPROVED'); assert.equal(state.stock(), 8);
  assert.equal(state.store.read('products/plant').reservedQuantity, 0);
});

test('Firestore transaction: competing drivers claim one delivery and receipt commits delivery and stock together', async () => {
  const { PdvRepository } = require('../src/orders/pdv.repository');
  const state = setup('transaction', { source: 'PDV', orderType: 'DELIVERY', status: 'AWAITING_PAYMENT', deliveryStatus: 'PENDING_DELIVERY', paymentMethod: 'DINHEIRO' });
  const pdv = new PdvRepository(state.repo); const driver = { id: 'driver', name: 'Entregador', role: 'ENTREGADOR' }; const other = { id: 'driver2', name: 'Outro', role: 'ENTREGADOR' };
  const results = await Promise.allSettled([pdv.assignDelivery('sale', driver), pdv.assignDelivery('sale', other)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const assigned = state.order().assignedDriver; await pdv.startDelivery('sale', assigned); state.store.failCommit = true;
  await assert.rejects(pdv.receive('sale', assigned, null, 20, 'DINHEIRO', { finishDelivery: true }), /Commit/);
  assert.equal(state.order().deliveryStatus, 'OUT_FOR_DELIVERY'); assert.equal(state.stock(), 10);
  assert.equal(state.store.read('delivery_driver_metrics/' + assigned.id), undefined);
  state.store.failCommit = false; await pdv.receive('sale', assigned, null, 20, 'DINHEIRO', { finishDelivery: true });
  assert.equal(state.order().deliveryStatus, 'DELIVERED'); assert.equal(state.order().paymentStatus, 'APPROVED'); assert.equal(state.stock(), 8);
  assert.equal(state.store.read('delivery_driver_metrics/' + assigned.id).deliveries, 1);
  await pdv.receive('sale', assigned, null, 20, 'DINHEIRO', { finishDelivery: true });
  assert.equal(state.store.read('delivery_driver_metrics/' + assigned.id).deliveries, 1);
});

for (const mode of ['memory', 'transaction']) {
  test(`${mode}: disabled stock permits a zero-stock web Pix without reserving or deducting inventory`, async () => {
    const initial = { 'products/plant': { id: 'plant', name: 'Planta', price: 10, stockQuantity: 0 }, 'store_settings/inventory': { stockControlEnabled: false } };
    const store = mode === 'transaction' ? transactionalStore(initial) : null;
    const repo = new FirestoreRepository({ isInMemory: true, firestoreInstance: store });
    if (!store) { await repo.saveInventorySettings({ stockControlEnabled: false }); repo.inMemoryProducts.set('plant', initial['products/plant']); }
    const order = await repo.createDirectOrder({ id: 'untracked-pix', source: 'WEB_CATALOG', status: 'AWAITING_PIX', paymentMethod: 'PIX', total: 20,
      pixData: { txid: '0123456789ABCDEF0123456789ABCDEF' }, items: [{ productId: 'plant', name: 'Planta', quantity: 2, price: 10 }] }, { reserveInventory: true });
    assert.equal(order.inventoryReserved, false);
    await repo.confirmOrderPayment(order.id, { verifiedVia: 'SICREDI_PIX_WEBHOOK', pixTxid: order.pixData.txid, paymentTransactionId: 'E' + '4'.repeat(31), paymentAmount: 20 });
    const product = store ? store.read('products/plant') : repo.inMemoryProducts.get('plant');
    assert.equal(product.stockQuantity, 0);
    assert.equal(Number(product.reservedQuantity || 0), 0);
  });
}

test('inventory setting persistence failure is reported instead of pretending the switch was saved', async () => {
  const repo = new FirestoreRepository({ isInMemory: true, firestoreInstance: { collection: () => ({ doc: () => ({ set: async () => { throw new Error('Persistence unavailable'); } }) }) } });
  await assert.rejects(repo.saveInventorySettings({ stockControlEnabled: false }), /Persistence unavailable/);
  assert.equal(repo.inMemoryInventorySettings?.stockControlEnabled === false, false);
});
