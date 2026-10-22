const { formatCurrency } = require('../shared/string.util');

function toTitleCase(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.toLowerCase().replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
}

class DirectPriceService {
  /**
   * Formats a direct, instant and contextualized response for a specific product query.
   * @param {Object} productGroup
   * @returns {string}
   */
  formatDirectPriceResponse(productGroup) {
    if (!productGroup || !Array.isArray(productGroup.prices) || productGroup.prices.length === 0) {
      return require('./customer-service-policy').PRICE_PENDING;
    }

    const { canonicalName, prices } = productGroup;
    const displayName = toTitleCase(canonicalName);
    const confirmedPrices = prices.filter(price => Number.isFinite(price) && price >= 0);
    if (!confirmedPrices.length) return require('./customer-service-policy').PRICE_PENDING;
    return `${displayName}: ${confirmedPrices.map(formatCurrency).join(' / ')}.${confirmedPrices.length > 1 ? ' Qual opção prefere?' : ''}`;
  }
}

module.exports = {
  DirectPriceService,
};
