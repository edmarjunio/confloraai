const test = require('node:test');
const assert = require('node:assert/strict');
const { formatCustomerOrderMessage } = require('../src/orders/customer-order-message');

const order = { ticketNumber: '5B2C71', customerName: 'TESTE', total: 427.44, paymentMethod: 'CARTAO', items: [
  { name: 'Abacaxi', quantity: 5, price: 8.99 },
  { name: 'Abiu amarelo', quantity: 2, price: 79 },
  { name: 'Abacate', quantity: 1.5, unit: 'KG', price: 8.99, subtotalMinor: 1349 },
  { name: 'Abóbora cabotiá', quantity: 3, price: 7 },
  { name: 'Aglaonema tricolor', quantity: 2, price: 95 },
] };

test('mensagem de confirmação segue o modelo solicitado com quantidades, kg e total exatos', () => {
  assert.equal(formatCustomerOrderMessage(order), [
    '🌿 *CONFLORA | HORTA E VIVEIRO*', '', '*Pedido #5B2C71*', '', '👤 *Cliente:* TESTE', '', '*🛒 Seu pedido:*',
    '5x Abacaxi — R$ 44,95', '2x Abiu amarelo — R$ 158,00', '1,5 kg Abacate — R$ 13,49', '3x Abóbora cabotiá — R$ 21,00', '2x Aglaonema tricolor — R$ 190,00', '',
    '💰 *Total: R$ 427,44*', '', '💳 *Pagamento: Cartão*', '💳 Estamos levando a maquininha para receber seu pagamento.', '', 'Obrigado pela preferência', '🌱 *Equipe Conflora*',
  ].join('\n'));
});

test('somente a forma de pagamento e sua orientação variam no modelo', () => {
  const pix = formatCustomerOrderMessage({ ...order, paymentMethod: 'PIX' });
  const cash = formatCustomerOrderMessage({ ...order, paymentMethod: 'DINHEIRO' });
  assert.match(pix, /⏳ Aguardamos a confirmação do pagamento via Pix para finalizar seu pedido\./);
  assert.match(cash, /💵 Estamos organizando o troco para levar até você\./);
  assert.doesNotMatch(pix, /maquininha|organizando o troco/);
  assert.equal(formatCustomerOrderMessage({ ...order, paymentMethod: 'DEBITO' }), formatCustomerOrderMessage(order));
  assert.equal(formatCustomerOrderMessage({ ...order, paymentMethod: 'CREDITO' }), formatCustomerOrderMessage(order));
});

test('pagamento combinado inclui cada orientação uma vez', () => {
  const text = formatCustomerOrderMessage({ ...order, paymentParts: [{ method: 'DEBITO' }, { method: 'CREDITO' }, { method: 'PIX' }] });
  assert.match(text, /Pagamento: Cartão \+ Pix/);
  assert.equal(text.match(/maquininha/g).length, 1);
  assert.match(text, /Aguardamos a confirmação/);
});
