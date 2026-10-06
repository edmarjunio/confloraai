/**
 * String normalization and formatting utilities.
 */

function normalizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatCurrency(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return 'R$ 0,00';
  }
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function parseCurrencyString(rawStr) {
  if (typeof rawStr === 'number') {
    return rawStr;
  }
  if (!rawStr || typeof rawStr !== 'string') {
    return 0;
  }
  const clean = rawStr.replace(/[^\d.,]/g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

function sanitizePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return '';
  }
  return phone.replace(/\D/g, '');
}

module.exports = {
  normalizeText,
  formatCurrency,
  parseCurrencyString,
  sanitizePhone,
};
