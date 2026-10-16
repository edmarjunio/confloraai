const test = require('node:test');
const assert = require('node:assert/strict');
const { getCashierProductDetails } = require('../src/catalog/cashier-product-details');

test('cashier product details expose registered care, habitat and feeding notes', () => {
  const details = getCashierProductDetails({
    descriptionAi: 'Planta ornamental para jardim.',
    cuidados_basicos: 'Regar quando o substrato estiver seco.',
    iluminacao: 'Luz indireta.',
    habitat: 'Aquário de água doce.',
    alimentacao: 'Ração específica para a espécie.',
  });

  assert.deepEqual(details, [
    { label: 'Descrição', value: 'Planta ornamental para jardim.' },
    { label: 'Cuidados', value: 'Regar quando o substrato estiver seco.' },
    { label: 'Iluminação', value: 'Luz indireta.' },
    { label: 'Ambiente ideal', value: 'Aquário de água doce.' },
    { label: 'Alimentação', value: 'Ração específica para a espécie.' },
  ]);
});

test('cashier product details omit fields that are not registered', () => {
  assert.deepEqual(getCashierProductDetails({ name: 'Produto sem especificações' }), []);
});
