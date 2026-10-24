const test = require('node:test');
const assert = require('node:assert/strict');
const { getCashierProductDetails } = require('../src/catalog/cashier-product-details');

test('cashier product details expose registered care, habitat and feeding notes', () => {
  const details = getCashierProductDetails({
    contentProvenance: { kind: 'STAFF_CONFIRMED', confirmedBy: 'isolated-staff', confirmedAt: '2026-10-23', fields: ['descriptionAi', 'cuidados_basicos', 'iluminacao', 'habitat', 'alimentacao'] },
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
    { label: 'Onde deixar / moradia', value: 'Aquário de água doce.' },
    { label: 'Alimentação', value: 'Ração específica para a espécie.' },
  ]);
});

test('cashier product details stay empty when no information was registered', () => {
  const details = getCashierProductDetails({ name: 'Produto sem especificações' });

  assert.deepEqual(details, []);
});
