const test = require('node:test');
const assert = require('node:assert/strict');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { OrderService } = require('../src/orders/order.service');
const { SalesConversationService } = require('../src/services/sales-conversation.service');

const phone = '5564999990001';
function fixture({ empty = false } = {}) {
  const repository = new FirestoreRepository({ isInMemory: true });
  repository.getInventorySettings = async () => ({ stockControlEnabled: true });
  repository.storefrontSettings = { config: { checkout: { delivery: { enabled: true, feeMinor: 500 } } } };
  if (!empty) repository.inMemoryProducts.set('lettuce', { id: 'lettuce', name: 'Alface', price: 4,
    unit: 'UN', status: 'ATIVO', stockQuantity: 20, reservedQuantity: 0 });
  const store = new PdvRepository(repository);
  const orders = new OrderService({ firestoreRepo: repository, catalogRepo: {} });
  const service = new SalesConversationService({ repository, orders, agent: { extractSalesIntent: async ({ message }) => JSON.parse(message) } });
  const say = input => service.handle({ phone, customerName: 'Cliente', message: JSON.stringify({ action: 'update', items: [], ...input }) });
  const choose = (result, name) => service.handle({ phone, interactiveId: result.buttons.find(button => button.id.startsWith(`sales_${name}:`)).id });
  return { repository, store, orders, service, say, choose };
}

test('empty database starts without products, users, sales or a fictitious quote', async () => {
  const { repository, say } = fixture({ empty: true });
  assert.equal((await repository.getAllProducts()).length, 0);
  assert.equal((await repository.getAllUsers()).length, 0);
  assert.equal((await repository.getAllOrders()).length, 0);
  const result = await say({ items: [{ name: 'Alface', quantity: 2 }] });
  assert.match(result.reply, /Podemos buscar por encomenda/);
  assert.doesNotMatch(result.reply, /R\$/);
  assert.equal(repository.inMemoryOrders.size, 0);
});

test('mixed request asks consent for procurement, then sells only available products', async () => {
  const { repository, store, say, choose } = fixture();
  const offer = await say({ items: [{ name: 'Alface', quantity: 2 }, { name: 'Lavanda', quantity: 3 }] });
  assert.match(offer.reply, /3 Lavanda/);
  assert.equal(repository.inMemoryOrders.size, 0);
  const sale = await choose(offer, 'yes');
  assert.match(sale.reply, /Encomenda registrada/);
  assert.match(sale.reply, /8,00/);
  const requests = await store.scanPage('agent_handoffs', 'kind', 'ORDER_REQUEST');
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].items.map(item => item.requestedName), ['Lavanda']);
  const payment = await choose(sale, 'pickup');
  const final = await choose(payment, 'cash');
  const receipt = await choose(final, 'yes');
  const order = await repository.getOrderById(receipt.orderId);
  assert.equal(order.total, 8);
  assert.equal(order.paymentStatus, 'PENDING');
  assert.deepEqual(order.items.map(item => item.productId), ['lettuce']);
  assert.equal(repository.inMemoryProducts.get('lettuce').reservedQuantity, 2);
});

test('declining procurement does not register an order for missing products', async () => {
  const { repository, store, say, choose } = fixture();
  const offer = await say({ items: [{ name: 'Lavanda', quantity: 1 }] });
  await choose(offer, 'no');
  assert.equal((await store.scanPage('agent_handoffs', 'kind', 'ORDER_REQUEST')).length, 0);
  assert.equal(repository.inMemoryOrders.size, 0);
});

test('price and stock changes require new consent before any sale', async () => {
  const { repository, say, choose } = fixture();
  const quote = await say({ items: [{ name: 'Alface', quantity: 2 }] });
  const payment = await choose(quote, 'pickup');
  const final = await choose(payment, 'cash');
  repository.inMemoryProducts.get('lettuce').price = 5;
  const revised = await choose(final, 'yes');
  assert.match(revised.reply, /10,00/);
  repository.inMemoryProducts.get('lettuce').stockQuantity = 0;
  const unavailable = await choose(revised, 'yes');
  assert.match(unavailable.reply, /Podemos buscar por encomenda/);
  assert.equal(repository.inMemoryOrders.size, 0);
});

test('delivery fee is disclosed and confirmed before the authoritative sale total', async () => {
  const { repository, say, choose } = fixture();
  const quote = await say({ items: [{ name: 'Alface', quantity: 2 }], fulfillment: 'DELIVERY', address: 'Rua das Flores, 123, Centro, Mineiros GO' });
  const delivery = quote;
  assert.match(delivery.reply, /Entrega:.*5,00/);
  assert.match(delivery.reply, /Total:.*13,00/);
  const payment = await choose(delivery, 'yes');
  const final = await choose(payment, 'cash');
  const receipt = await choose(final, 'yes');
  const order = await repository.getOrderById(receipt.orderId);
  assert.equal(order.total, 13);
  assert.equal(order.deliveryFee, 5);
  assert.equal(order.paymentStatus, 'PENDING');
});

test('stale confirmation cannot create duplicate sales and a new cart gets a new identity', async () => {
  const { repository, say, choose } = fixture();
  const quote = await say({ items: [{ name: 'Alface', quantity: 1 }] });
  const payment = await choose(quote, 'pickup');
  const stale = await choose(quote, 'pickup');
  assert.match(stale.reply, /opção mudou/);
  const final = await choose(payment, 'cash');
  const first = await choose(final, 'yes');
  const secondQuote = await say({ items: [{ name: 'Alface', quantity: 1 }] });
  const nextPayment = await choose(secondQuote, 'pickup');
  const nextFinal = await choose(nextPayment, 'cash');
  const second = await choose(nextFinal, 'yes');
  assert.notEqual(first.orderId, second.orderId);
  assert.equal(repository.inMemoryOrders.size, 2);
});

test('invalid quantities never reserve inventory or create money', async () => {
  const { repository, say } = fixture();
  for (const quantity of [-1, 0, 10001]) await assert.rejects(say({ items: [{ name: 'Alface', quantity }] }));
  assert.equal(repository.inMemoryOrders.size, 0);
  assert.equal(repository.inMemoryProducts.get('lettuce').reservedQuantity, 0);
});
test('AI extraction keeps explicit items even when the model mislabels them as confirmation', async () => {
  const { repository, service } = fixture();
  service.agent = { extractSalesIntent: async () => ({ action: 'confirm', query: false, items: [{ name: 'Alface', quantity: 4 }], fulfillment: 'PICKUP', paymentMethod: 'DINHEIRO', address: null }) };
  const result = await service.handle({ phone, message: 'Na retirada eu precisaria de quatro alfaces e pagaria em dinheiro.' });
  assert.match(result.reply, /4 Alface/); assert.match(result.reply, /Confirma a criação da comanda/);
  assert.equal(repository.inMemoryOrders.size, 0);
});
