const { formatCurrency } = require('../shared/string.util');

function toTitleCase(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.toLowerCase().replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
}

function resolveArticle(productName) {
  const lower = productName.toLowerCase();
  const feminineHints = [
    'palmeira',
    'muda',
    'rosa',
    'orquidea',
    'samambaia',
    'azaleia',
    'alface',
    'gaiola',
    'racao',
    'hortela',
    'banana',
    'batata',
    'amaranta',
    'areca',
  ];
  return feminineHints.some((hint) => lower.includes(hint)) ? 'A' : 'O';
}

class DirectPriceService {
  /**
   * Formats a direct, instant and contextualized response for a specific product query.
   * @param {Object} productGroup
   * @returns {string}
   */
  formatDirectPriceResponse(productGroup) {
    if (!productGroup || !Array.isArray(productGroup.prices) || productGroup.prices.length === 0) {
      return 'No momento este produto não possui valores ativos cadastrados no catálogo.';
    }

    const { canonicalName, prices, category } = productGroup;
    const displayName = toTitleCase(canonicalName);
    const article = resolveArticle(canonicalName);
    const isPet = (category || '').toLowerCase().includes('pet');

    if (prices.length === 1) {
      const priceText = formatCurrency(prices[0]);
      if (isPet) {
        return (
          `${article} ${displayName} está saindo por ${priceText}.\n\n` +
          `Gostaria que eu te envie fotos dele? Temos também a gaiola e a ração própria disponíveis aqui na Conflora se você precisar!`
        );
      }
      return `${article} ${displayName} está saindo por ${priceText}. Deseja que eu reserve uma unidade para você ou gostaria de ver fotos?`;
    }

    if (prices.length === 2) {
      const p1 = formatCurrency(prices[0]);
      const p2 = formatCurrency(prices[1]);
      if (isPet) {
        return `${article} ${displayName}, temos de ${p1} e de ${p2}. Deseja que eu te envie fotos deles?`;
      }
      return `${article} ${displayName}, temos de ${p1} e de ${p2} (variando pelo porte da muda). Você prefere para plantar em vaso ou direto no solo?`;
    }

    const priceList = prices.map((p) => formatCurrency(p)).join(', ');
    return `${article} ${displayName} temos nas opções de ${priceList}, conforme o tamanho/porte. Como prefere?`;
  }
}

module.exports = {
  DirectPriceService,
};
