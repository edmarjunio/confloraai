'use strict';

/**
 * Regras de precisão (versionadas em COMMERCIAL_RULES_VERSION):
 * - Preço unitário: centavos inteiros. Valores com mais de 2 casas decimais são inválidos (não são arredondados).
 * - Quantidade: milésimos inteiros (3 casas, como o estoque por KG do sistema). UN exige inteiro.
 * - Subtotal da linha = round-half-up(precoCentavos * quantidadeMilesimos / 1000), calculado por linha.
 * - Subtotal dos produtos = soma dos subtotais de linha (nunca recalculado a partir do total).
 */
const COMMERCIAL_RULES_VERSION = 'conflora-agent-rules/2026-10-19.1';

const SALE_UNITS = Object.freeze({
  UN: Object.freeze({ code: 'UN', label: 'unidade', defaultMin: 1, defaultIncrement: 1 }),
  KG: Object.freeze({ code: 'KG', label: 'kg', defaultMin: 0.1, defaultIncrement: 0.1 }),
});

const MAX_QUANTITY_MILLI = 1_000_000; // 1000 unidades/kg por linha
const MAX_PRICE_CENTS = 10_000_000_00; // R$ 10 milhões, limite de sanidade

function priceToCents(value) {
  if (value === undefined || value === null) return null;
  let num;
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    let s = value.trim().replace(/^R\$\s?/, '');
    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    num = Number(s);
  } else {
    return null;
  }
  if (!Number.isFinite(num) || num <= 0) return null;
  const cents = Math.round(num * 100);
  if (Math.abs(num * 100 - cents) > 1e-4 || cents <= 0 || cents > MAX_PRICE_CENTS) return null;
  return cents;
}

function numberToMilli(value) {
  if (value === undefined || value === null) return null;
  let num;
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    num = Number(value.trim().replace(',', '.'));
  } else {
    return null;
  }
  if (!Number.isFinite(num)) return null;
  const milli = Math.round(num * 1000);
  return Math.abs(num * 1000 - milli) <= 1e-4 ? milli : null;
}

/** Converte entrada (número ou texto "2,5") em milésimos. Retorna { milli } ou { error }. */
function parseQuantity(raw, unitCode) {
  let milli;
  if (typeof raw === 'number') {
    milli = numberToMilli(raw);
  } else if (typeof raw === 'string' && /^\d+(?:[.,]\d{1,3})?$/.test(raw.trim())) {
    const [whole, frac = ''] = raw.trim().replace(',', '.').split('.');
    milli = Number(whole) * 1000 + Number(frac.padEnd(3, '0'));
  } else {
    milli = null;
  }
  if (milli === null || milli <= 0) return { error: 'quantity_invalid' };
  if (milli > MAX_QUANTITY_MILLI) return { error: 'quantity_too_large' };
  if (unitCode === 'UN' && milli % 1000 !== 0) return { error: 'quantity_not_integer_for_unit' };
  return { milli };
}

/** Confere mínimo e incremento da unidade de venda (valores em milésimos). */
function checkQuantityRules(milli, saleUnit) {
  if (milli < saleUnit.minMilli) return 'quantity_below_minimum';
  if (milli % saleUnit.incMilli !== 0) return 'quantity_not_multiple_of_increment';
  return null;
}

function lineSubtotalCents(unitPriceCents, quantityMilli) {
  const product = unitPriceCents * quantityMilli;
  if (!Number.isSafeInteger(product)) throw new RangeError('Subtotal fora do intervalo seguro.');
  return Math.floor((product + 500) / 1000);
}

function formatBRL(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const reais = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}R$ ${reais},${String(abs % 100).padStart(2, '0')}`;
}

function formatQuantity(milli, unitCode) {
  if (unitCode === 'UN') return String(milli / 1000);
  return (milli / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

function unitLabel(unitCode) {
  return SALE_UNITS[unitCode]?.label ?? null;
}

module.exports = {
  COMMERCIAL_RULES_VERSION, SALE_UNITS, MAX_QUANTITY_MILLI,
  priceToCents, numberToMilli, parseQuantity, checkQuantityRules, lineSubtotalCents,
  formatBRL, formatQuantity, unitLabel,
};
