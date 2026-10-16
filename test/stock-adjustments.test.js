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
