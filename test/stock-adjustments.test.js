const assert = require('node:assert/strict');
const test = require('node:test');
const { FirestoreRepository } = require('../src/database/firestore.repository');

test('ajustes de estoque são registrados uma única vez por requestId', async () => {
  const repository = new FirestoreRepository({ isInMemory: true });
  await repository.saveProduct({ id: 'stock-widget', name: 'Muda teste', category: 'Plantas / Mudas', stockQuantity: 10 });

  const entry = await repository.adjustStock({
    productId: 'stock-widget', operation: 'ENTRY', quantity: 5, requestId: 'stock-entry-0001',
    actor: { id: 'admin-1', name: 'Admin teste' },
  });
  const duplicate = await repository.adjustStock({
    productId: 'stock-widget', operation: 'ENTRY', quantity: 5, requestId: 'stock-entry-0001',
  });

  assert.equal(entry.previousStock, 10);
  assert.equal(entry.newStock, 15);
  assert.equal(duplicate.duplicate, true);
  assert.equal((await repository.getAllProducts())[0].stockQuantity, 15);
  assert.equal((await repository.getStockMovements()).length, 1);
});

test('baixa exige justificativa, bloqueia saldo negativo e conta substitui o saldo', async () => {
  const repository = new FirestoreRepository({ isInMemory: true });
  await repository.saveProduct({ id: 'stock-count', name: 'Produto contado', stockQuantity: 40 });

  await assert.rejects(
    repository.adjustStock({ productId: 'stock-count', operation: 'EXIT', quantity: 1, requestId: 'stock-no-reason' }),
    /motivo/i,
  );
  await assert.rejects(
    repository.adjustStock({ productId: 'stock-count', operation: 'EXIT', quantity: 41, reason: 'Ajuste de quebra', requestId: 'stock-overdraw' }),
    /insuficiente/i,
  );
  const exit = await repository.adjustStock({
    productId: 'stock-count', operation: 'EXIT', quantity: 4,
    reason: 'Unidades danificadas na conferência', requestId: 'stock-exit-0001',
  });
  const count = await repository.adjustStock({
    productId: 'stock-count', operation: 'SET', quantity: 15,
    reason: 'Contagem física do corredor', requestId: 'stock-count-0001',
  });

  assert.equal(exit.newStock, 36);
  assert.equal(count.previousStock, 36);
  assert.equal(count.newStock, 15);
  assert.equal((await repository.getAllProducts())[0].stockQuantity, 15);
  assert.equal((await repository.getStockMovements()).length, 2);
});

test('baixa gera notificações para todos os administradores ativos', async () => {
  const repository = new FirestoreRepository({ isInMemory: true });
  repository.getAllUsers = async () => [
    { id: 'admin-a', name: 'Admin A', role: 'ADMIN', active: true },
    { id: 'admin-b', name: 'Admin B', role: 'ADMIN', active: true },
    { id: 'cashier-a', name: 'Caixa', role: 'CAIXA', active: true },
  ];

  await repository.notifyAllAdminUsersOfStockAdjustment({
    operation: 'EXIT', productId: 'plant-1', productName: 'Rosa', quantity: 2,
    previousStock: 8, newStock: 6, reason: 'Folhas danificadas', actorName: 'Operador',
  });

  assert.deepEqual(repository.inMemoryNotifications.map((notification) => notification.toUserId).sort(), ['admin-a', 'admin-b']);
  assert.ok(repository.inMemoryNotifications.every((notification) => notification.reason === 'Folhas danificadas'));
});


test('conferência rejeita saldo alterado e não reduz estoque reservado', async () => {
  const repository = new FirestoreRepository({ isInMemory: true });
  await repository.saveProduct({ id: 'concurrent-count', name: 'Muda', stockQuantity: 10, reservedQuantity: 3 });
  await repository.adjustStock({ productId: 'concurrent-count', operation: 'ENTRY', quantity: 1, requestId: 'parallel-entry' });
  await assert.rejects(repository.adjustStock({ productId: 'concurrent-count', operation: 'SET', quantity: 8, expectedStock: 10, reason: 'Conferência física', requestId: 'stale-count' }), /estoque mudou/);
  await assert.rejects(repository.adjustStock({ productId: 'concurrent-count', operation: 'SET', quantity: 2, expectedStock: 11, reason: 'Conferência física', requestId: 'reserved-count' }), /reservadas/);
  const count = await repository.adjustStock({ productId: 'concurrent-count', operation: 'SET', quantity: 8, expectedStock: 11, reason: 'Conferência física', requestId: 'safe-count' });
  assert.equal(count.newStock, 8);
  assert.equal((await repository.adjustStock({ productId: 'concurrent-count', operation: 'SET', quantity: 8, expectedStock: 11, reason: 'Conferência física', requestId: 'safe-count' })).duplicate, true);
});


test('digitar 100 na conferência substitui o saldo negativo e mantém o saldo exatamente 100', async () => {
  const repository = new FirestoreRepository({ isInMemory: true });
  repository.inMemoryProducts.set('negative-product', { id: 'negative-product', name: 'Produto com saldo antigo negativo', stockQuantity: -15 });
  const result = await repository.adjustStock({ productId: 'negative-product', operation: 'SET', quantity: 100, expectedStock: -15, reason: 'Conferência física digitada', requestId: 'count-negative-100' });
  assert.equal(result.previousStock, -15);
  assert.equal(result.newStock, 100);
  assert.equal(repository.inMemoryProducts.get('negative-product').stockQuantity, 100);
});
