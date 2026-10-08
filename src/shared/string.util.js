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
  return require('../i18n').currency(value).replace(/\u00a0/g, ' ');
}

function parseCurrencyString(rawStr) {
  if (typeof rawStr === 'number') {
    return isNaN(rawStr) ? 0 : rawStr;
  }
  if (!rawStr || typeof rawStr !== 'string') {
    return 0;
  }
  let clean = rawStr.replace(/[^\d.,]/g, '').trim();
  if (!clean) {
    return 0;
  }

  const hasComma = clean.includes(',');
  const hasDot = clean.includes('.');

  if (hasComma && hasDot) {
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    if (lastDot > lastComma) {
      // US Format e.g. "2,900.00" -> strip commas
      clean = clean.replace(/,/g, '');
    } else {
      // Brazilian Format e.g. "2.900,00" -> strip dots, replace comma with dot
      clean = clean.replace(/\./g, '').replace(',', '.');
    }
  } else if (hasComma) {
    // Only comma e.g. "8,00" or "2900,00"
    clean = clean.replace(',', '.');
  }

  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

function sanitizePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return '';
  }
  return phone.replace(/\D/g, '');
}

function toSingular(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return normalizeText(text)
    .split(' ')
    .map((w) => (w.endsWith('s') && w.length > 3 ? w.slice(0, -1) : w))
    .join(' ');
}

module.exports = {
  normalizeText,
  formatCurrency,
  parseCurrencyString,
  sanitizePhone,
  toSingular,
};
