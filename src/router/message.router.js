const { normalizeText } = require('../shared/string.util');

const INTENTS = Object.freeze({
  DIRECT_PRICE: 'DIRECT_PRICE',
  REQUEST_PHOTOS: 'REQUEST_PHOTOS',
  CONSULTATIVE_SALES: 'CONSULTATIVE_SALES',
  ORDER_CONFIRMATION: 'ORDER_CONFIRMATION',
  GENERAL_CHAT: 'GENERAL_CHAT',
});

const PRICE_TRIGGER_PATTERNS = [
  /qual (o )?(valor|preco)/,
  /quanto custa/,
  /quanto (e|ta|sai)/,
  /valor d[aoe]/,
  /preco d[aoe]/,
  /tabela de preco/,
];

const PHOTO_TRIGGER_PATTERNS = [
  /\b(foto|fotos|imagem|imagens)\b/,
  /\bmostra(r)?\b/,
  /\bver\b/,
];

const BROAD_CATEGORY_TRIGGER_PATTERNS = [
  /(voces|vcs) (tem|possuem|trabalham com)/,
  /^tem /,
  /quais (sao as )?/,
  /gostaria de saber se tem/,
  /quais (tipos|opcoes|modelos)/,
];

const ORDER_CLOSING_PATTERNS = [
  /(quero|vou) (fechar|levar|comprar|fazer o pedido)/,
  /confirmo (o pedido)?/,
  /pode mandar o pix/,
  /qual a chave pix/,
];

class MessageRouter {
  /**
   * @param {import('../catalog/catalog.repository').CatalogRepository} catalogRepository
   */
  constructor(catalogRepository) {
    if (!catalogRepository) {
      throw new Error('MessageRouter requires a CatalogRepository instance');
    }
    this.catalogRepository = catalogRepository;
  }

  /**
   * Classifies an incoming message into an executable routing decision.
   * @param {string} rawMessage
   * @returns {{ intent: string, matchedProduct?: Object, suggestedProducts?: Array<Object> }}
   */
  route(rawMessage) {
    if (!rawMessage || typeof rawMessage !== 'string' || !rawMessage.trim()) {
      return { intent: INTENTS.GENERAL_CHAT };
    }

    const normalized = normalizeText(rawMessage);

    // 0. Confirmação / Fechamento de Pedido
    if (ORDER_CLOSING_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return { intent: INTENTS.ORDER_CONFIRMATION };
    }

    // 1. Pedido de fotos (ex: "manda foto da palmeira rabo de raposa", "pode me mandar foto", "tem fotos?")
    if (PHOTO_TRIGGER_PATTERNS.some((pattern) => pattern.test(normalized))) {
      const matchedProduct = this.findMatchingProduct(normalized);
      const categoryMatches = this.findMatchingCategoryOrProducts(normalized);
      return {
        intent: INTENTS.REQUEST_PHOTOS,
        matchedProduct: matchedProduct || null,
        suggestedProducts: categoryMatches,
      };
    }

    // 2. Consulta direta de preço (Fast-Path Grounding)
    const isPriceInquiry = PRICE_TRIGGER_PATTERNS.some((pattern) => pattern.test(normalized));
    if (isPriceInquiry) {
      const matchedProduct = this.findMatchingProduct(normalized);
      if (matchedProduct) {
        return {
          intent: INTENTS.DIRECT_PRICE,
          matchedProduct,
        };
      }
    }

    // 3. Consulta de categoria ampla ou catálogo aberto (ex: "Vocês tem palmeiras?")
    const isBroadInquiry = BROAD_CATEGORY_TRIGGER_PATTERNS.some((pattern) => pattern.test(normalized));
    const categoryMatches = this.findMatchingCategoryOrProducts(normalized);

    if (isBroadInquiry || categoryMatches.length > 1) {
      if (categoryMatches.length > 0) {
        return {
          intent: INTENTS.CONSULTATIVE_SALES,
          suggestedProducts: categoryMatches,
        };
      }
    }

    // 4. Se o usuário apenas digitou o nome de um produto (ex: "Palmeira Azul")
    const directProduct = this.catalogRepository.findProductByName(normalized);
    if (directProduct) {
      return {
        intent: INTENTS.DIRECT_PRICE,
        matchedProduct: directProduct,
      };
    }

    // 5. Fallback: Diálogo consultivo padrão
    return {
      intent: INTENTS.CONSULTATIVE_SALES,
      suggestedProducts: [],
    };
  }

  findMatchingProduct(normalizedText) {
    const cleanedText = normalizedText
      .replace(/^(qual|quanto|o|a|de|e|da|do|valor|preco|custa|sai|ta|manda|mandar|envia|enviar|pode|me|foto|fotos|imagem|imagens)\s+/g, '')
      .replace(/\b(qual|quanto|o|a|de|e|da|do|valor|preco|custa|sai|ta|manda|mandar|envia|enviar|pode|me|foto|fotos|imagem|imagens)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const product = this.catalogRepository.findProductByName(cleanedText);
    if (product) {
      return product;
    }

    return this.catalogRepository.findProductByName(normalizedText);
  }

  findMatchingCategoryOrProducts(normalizedText) {
    const words = normalizedText.split(' ').filter((w) => w.length > 3);
    for (const word of words) {
      const singularWord = word.endsWith('s') ? word.slice(0, -1) : word;
      const products = this.catalogRepository.findProductsByCategory(singularWord);
      if (products.length > 0) {
        return products;
      }
    }
    return [];
  }
}

module.exports = {
  INTENTS,
  MessageRouter,
};
