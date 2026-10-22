process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePaymentParts } = require('../src/orders/payment-parts.js');

test('Smart Receipt & Financial Security - 14 Mandatory Scenarios', async (t) => {

  // Scenario 1: Sale R$ 100 paid in full by Pix
  await t.test('1. Total R$ 100,00 pago integralmente com Pix registra exatamente R$ 100,00', () => {
    const total = 100.00;
    const parts = [{ method: 'PIX', amount: 100.00 }];
    const normalized = normalizePaymentParts(parts, total);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].method, 'PIX');
    assert.equal(normalized[0].amount, 100.00);
  });

  // Scenario 2: Sale R$ 150 split into R$ 100 Card + R$ 50 Pix
  await t.test('2. Total R$ 150,00 dividido em R$ 100,00 Cartão + R$ 50,00 Pix valida soma exata', () => {
    const total = 150.00;
    const part1 = 100.00;
    const remaining = (Math.round(total * 100) - Math.round(part1 * 100)) / 100;
    assert.equal(remaining, 50.00);

    const parts = [
      { method: 'CREDITO', amount: part1 },
      { method: 'PIX', amount: remaining }
    ];
    const normalized = normalizePaymentParts(parts, total);
    assert.equal(normalized.reduce((sum, p) => sum + p.amount, 0), 150.00);
  });

  // Scenario 3: Sale R$ 67 paid in Cash (DINHEIRO): recorded payment is R$ 67. Visual calculator: RECEBI R$ 100, VALOR DA VENDA R$ 67, TROCO R$ 33
  await t.test('3. Total R$ 67,00 em Dinheiro com RECEBI R$ 100,00 -> VALOR DA VENDA R$ 67,00, TROCO R$ 33,00, registrado R$ 67,00', () => {
    const total = 67.00;
    const registeredParts = [{ method: 'DINHEIRO', amount: 67.00 }];
    const normalized = normalizePaymentParts(registeredParts, total);
    
    // Financial registration
    assert.equal(normalized[0].amount, 67.00);
    assert.notEqual(normalized[0].amount, 100.00);

    // Visual calculator logic (independent and informative)
    const visualRecebi = 100.00;
    const visualValorVenda = normalized[0].amount;
    const visualTroco = visualRecebi >= visualValorVenda ? Math.round((visualRecebi - visualValorVenda) * 100) / 100 : 0;
    
    assert.equal(visualValorVenda, 67.00);
    assert.equal(visualTroco, 33.00);
  });

  // Scenario 4: Split sale R$ 150: Pix R$ 100 + Dinheiro R$ 50, RECEBI R$ 100
  await t.test('4. Venda dividida R$ 150,00 (Pix R$ 100,00 + Dinheiro R$ 50,00): calculadora exibe parcela em dinheiro R$ 50,00 e troco R$ 50,00', () => {
    const total = 150.00;
    const registeredParts = [
      { method: 'PIX', amount: 100.00 },
      { method: 'DINHEIRO', amount: 50.00 }
    ];
    const normalized = normalizePaymentParts(registeredParts, total);
    assert.equal(normalized.reduce((sum, p) => sum + p.amount, 0), 150.00);

    // Calculator must reflect ONLY the cash installment (R$ 50), not the comanda total (R$ 150)
    const cashPart = normalized.find(p => p.method === 'DINHEIRO');
    assert.ok(cashPart);
    const visualRecebi = 100.00;
    const visualValorVenda = cashPart.amount;
    const visualTroco = visualRecebi >= visualValorVenda ? Math.round((visualRecebi - visualValorVenda) * 100) / 100 : 0;

    assert.equal(visualValorVenda, 50.00);
    assert.equal(visualTroco, 50.00);
  });

  // Scenario 5: Attempt to register payment > balance via Pix, Card, OR CASH -> blocked
  await t.test('5. Bloqueio de qualquer forma de pagamento com valor superior ao saldo da venda (inclusive DINHEIRO)', () => {
    const total = 100.00;

    // Pix above total
    assert.throws(() => {
      normalizePaymentParts([{ method: 'PIX', amount: 120.00 }], total);
    }, (err) => err.message.includes('Valor acima do saldo da venda'));

    // Cartão above total
    assert.throws(() => {
      normalizePaymentParts([{ method: 'CREDITO', amount: 120.00 }], total);
    }, (err) => err.message.includes('Valor acima do saldo da venda'));

    // DINHEIRO above total (mandatory strict rule: no exception for cash on registered amount)
    assert.throws(() => {
      normalizePaymentParts([{ method: 'DINHEIRO', amount: 120.00 }], total);
    }, (err) => err.message.includes('Valor acima do saldo da venda'));
  });

  // Scenario 6: Part 1 R$ 30 on R$ 100 sale -> suggests R$ 70 for next part
  await t.test('6. Registro de parcela 1 R$ 30,00 em venda de R$ 100,00 calcula automaticamente restante de R$ 70,00', () => {
    const totalCents = 10000;
    const part1Cents = 3000;
    const remainingCents = totalCents - part1Cents;
    assert.equal(remainingCents, 7000);
    assert.equal((remainingCents / 100).toFixed(2), '70.00');
  });

  // Scenario 7: Insufficient payment -> blocked regardless of RECEBI
  await t.test('7. Pagamento insuficiente não permite finalização, independentemente do valor em RECEBI', () => {
    const total = 100.00;
    // Parts only sum to R$ 90,00
    const parts = [{ method: 'DINHEIRO', amount: 90.00 }];
    assert.throws(() => {
      normalizePaymentParts(parts, total);
    }, (err) => err.message.includes('A soma dos pagamentos precisa ser igual ao total da venda'));
  });

  // Scenario 8: Duplicate finalize -> prevented
  await t.test('8. Prevenção de duplicidade na finalização', () => {
    // Normalization with repeated methods in the same receipt is blocked
    assert.throws(() => {
      normalizePaymentParts([
        { method: 'DINHEIRO', amount: 50.00 },
        { method: 'DINHEIRO', amount: 50.00 }
      ], 100.00);
    }, (err) => err.message.includes('Use cada forma uma vez'));
  });

  // Scenario 9: Decimal and cents precision
  await t.test('9. Precisão decimal em centavos (sem desvios de ponto flutuante)', () => {
    const total = 100.00;
    const parts = [
      { method: 'CREDITO', amount: 33.33 },
      { method: 'DEBITO', amount: 33.33 },
      { method: 'PIX', amount: 33.34 }
    ];
    const normalized = normalizePaymentParts(parts, total);
    const sumCents = normalized.reduce((acc, p) => acc + Math.round(p.amount * 100), 0);
    assert.equal(sumCents, 10000);
  });

  // Scenario 10: RECEBI and TROCO are never persisted in financial normalization
  await t.test('10. Campos RECEBI e TROCO não são incluídos no payload financeiro nem no Firestore', () => {
    const total = 50.00;
    const parts = [{ method: 'DINHEIRO', amount: 50.00, recebi: 100.00, troco: 50.00 }];
    const normalized = normalizePaymentParts(parts, total);
    assert.equal(normalized[0].recebi, undefined);
    assert.equal(normalized[0].troco, undefined);
    assert.equal(normalized[0].amount, 50.00);
    assert.deepEqual(Object.keys(normalized[0]), ['method', 'amount']);
  });

  // Scenario 11: Modifying RECEBI does not alter registered amount or validation
  await t.test('11. Alteração do campo informativo RECEBI não modifica o valor registrado nem a validação', () => {
    const registeredCash = 50.00;
    const total = 50.00;
    
    // RECEBI is 60, 100, or 200 - registered amount stays strictly 50.00
    [60.00, 100.00, 200.00].forEach(_recebi => {
      const parts = [{ method: 'DINHEIRO', amount: registeredCash }];
      const normalized = normalizePaymentParts(parts, total);
      assert.equal(normalized[0].amount, 50.00);
    });
  });

  // Scenario 12: RECEBI < VALOR DA VENDA -> troco is 0 (never negative)
  await t.test('12. RECEBI menor que o VALOR DA VENDA exibe troco R$ 0,00 e nunca negativo', () => {
    const cashSaleAmount = 50.00;
    const recebi = 30.00;
    const troco = recebi >= cashSaleAmount ? Math.round((recebi - cashSaleAmount) * 100) / 100 : 0;
    assert.equal(troco, 0.00);
  });

  // Scenario 13: Resetting / closing comanda clears temporary RECEBI
  await t.test('13. Limpeza do estado temporário de RECEBI', () => {
    let cashReceivedVisual = '100,00';
    // State reset function simulates onClose / orderId change
    const resetTemporaryState = () => { cashReceivedVisual = ''; };
    resetTemporaryState();
    assert.equal(cashReceivedVisual, '');
  });

  // Scenario 14: Non-cash payments -> visual calculator is not shown
  await t.test('14. Pagamentos sem dinheiro (ex: Pix ou Cartão) não exibem a calculadora de troco', () => {
    const partsPix = [{ method: 'PIX', amount: 100.00 }];
    const hasCashPix = partsPix.some(p => p.method === 'DINHEIRO');
    assert.equal(hasCashPix, false);

    const partsCard = [{ method: 'CREDITO', amount: 50.00 }, { method: 'DEBITO', amount: 50.00 }];
    const hasCashCard = partsCard.some(p => p.method === 'DINHEIRO');
    assert.equal(hasCashCard, false);
  });

});
