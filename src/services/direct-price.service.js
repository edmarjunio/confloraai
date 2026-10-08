const { t } = require('../i18n');
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
      return t("interface.message.b5e591d33d91");
    }

    const { canonicalName, prices, category } = productGroup;
    const displayName = toTitleCase(canonicalName);
    const article = resolveArticle(canonicalName);
    const isPet = (category || '').toLowerCase().includes('pet');

    if (prices.length === 1) {
      const priceText = formatCurrency(prices[0]);
      if (isPet) {
        return (
          `${article} ${displayName}${t("interface.message.1a27517e5083")}${priceText}.\n\n` +
          `${t("interface.message.aa3f4c3e3223")}`
        );
      }
      return `${article} ${displayName}${t("interface.message.1a27517e5083")}${priceText}${t("interface.message.f31575617992")}`;
    }

    if (prices.length === 2) {
      const p1 = formatCurrency(prices[0]);
      const p2 = formatCurrency(prices[1]);
      if (isPet) {
        return `${article} ${displayName}${t("interface.fragment.4318e2315aba")}${p1} e de ${p2}. Deseja que eu te envie fotos deles?`;
      }
      return `${article} ${displayName}${t("interface.fragment.4318e2315aba")}${p1} e de ${p2}${t("interface.message.f7e90b5168a2")}`;
    }

    const priceList = prices.map((p) => formatCurrency(p)).join(', ');
    return `${article} ${displayName}${t("interface.message.a75fcc5b5aa3")}${priceList}${t("interface.fragment.7852b5e79fb1")}`;
  }
}

module.exports = {
  DirectPriceService,
};
