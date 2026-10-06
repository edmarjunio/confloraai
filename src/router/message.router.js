const { normalizeText, toSingular } = require('../shared/string.util');

const INTENTS = Object.freeze({
  DIRECT_PRICE: 'DIRECT_PRICE',
  REQUEST_PHOTOS: 'REQUEST_PHOTOS',
  CONSULTATIVE_SALES: 'CONSULTATIVE_SALES',
  ORDER_CONFIRMATION: 'ORDER_CONFIRMATION',
  PLACE_ORDER: 'PLACE_ORDER',
  UPDATE_ORDER_DETAILS: 'UPDATE_ORDER_DETAILS',
  ASK_SIZE_CONFIRMATION: 'ASK_SIZE_CONFIRMATION',
  GENERAL_CHAT: 'GENERAL_CHAT',
});

const ORDER_CONFIRMATION_PATTERNS = [
  /^(pode )?(confirmar|confirmo|fechar|fechado|manda o pix|qual a chave pix|pode mandar|tudo certo|esta certo|correto)\b/i,
  /^(sim|ok|fechou|isso|perfeito|pode ser|confirma)\b/i,
  /(quero|vou) (fechar|comprar|fazer o pedido)/i,
];

const PHOTO_TRIGGER_PATTERNS = [
  /\b(foto|fotos|imagem|imagens)\b/i,
  /\bmostra(r)?\b/i,
  /\bver fotos\b/i,
];

const PAYMENT_UPDATE_PATTERNS = [
  /\b(debito|credito|cartao|pix|dinheiro|a vista)\b/i,
  /\b(vai ser|pago|pagar|pagamento) (no|em|com|via)\b/i,
];

const ADDRESS_UPDATE_PATTERNS = [
  /\b(entregar em|entrega em|endereco|rua|avenida|av\.|bairro)\b/i,
];

function isOrderMessage(rawText) {
  const norm = normalizeText(rawText);
  if (/^(qual|quanto|quais|voces?|vcs?|tem|teria|foto|fotos|imagem|imagens|pode me mandar foto|pode mandar foto)\b/i.test(norm)) {
    return false;
  }
  if (/^(manda pra mim|manda|me manda|quero|vou querer|ve pra mim|por favor manda|manda ai)\s+/i.test(norm)) {
    return true;
  }
  if (/^\d+\s*(?:x\s*)?[a-z]/i.test(norm)) {
    return true;
  }
  return false;
}

function cleanConversationalPrefixes(text) {
  let cleaned = normalizeText(text);

  const prefixes = [
    /^(ola|oi|bom dia|boa tarde|boa noite|opa|por favor|por gentileza)\b/g,
    /^(gostaria de saber se (voces?|vcs?) (tem|trabalham com|vendem|possuem))\b/g,
    /^(gostaria de saber se tem)\b/g,
    /^(saber se (voces?|vcs?) (tem|trabalham com|vendem|possuem))\b/g,
    /^(saber se tem)\b/g,
    /^(voces?|vcs?) (tem|possuem|trabalham com|vendem|vende)\b/g,
    /^(tem|teria|teriam)\b/g,
    /^(trabalham com|trabalha com|vende|vendem)\b/g,
    /^(qual|quais) (e o |sao as? |o )?(valor|preco|tabela de precos?)\s*(d[aoe]s?)?\b/g,
    /^(quanto (custa|e|ta|sai))\s*(o|a|os|as)?\b/g,
    /^(valor|preco) d[aoe]s?\b/g,
    /^(manda|mandar|envia|enviar|me manda|manda pra mim|quero|vou querer|ve pra mim)\b/g,
    /^(pode me mandar|pode mandar|da pra mandar)\b/g,
    /^(pra mim|para mim)\b/g,
    /^(foto|fotos|imagem|imagens) d[aoe]s?\b/g,
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const p of prefixes) {
      const prev = cleaned;
      cleaned = cleaned.replace(p, '').trim();
      if (cleaned !== prev) {
        changed = true;
      }
    }
  }

  cleaned = cleaned.replace(/^(d[aoe]s?|um|uma|uns|umas|o|a|os|as)\s+/g, '').trim();
  return cleaned;
}

function parseOrderItems(rawText) {
  if (!rawText || typeof rawText !== 'string' || !isOrderMessage(rawText)) {
    return [];
  }

  let clean = rawText
    .replace(/^(manda pra mim|manda|me manda|quero|vou querer|ve pra mim|por favor manda|manda ai)\s+/i, '')
    .trim();

  const parts = clean.split(/[,;\n]|\s+\be\b\s+/i).map((p) => p.trim()).filter(Boolean);
  const items = [];

  for (const part of parts) {
    const normPart = normalizeText(part);
    const qtyMatch = normPart.match(/^(\d+)\s*(?:x\s*)?(.*)$/i);
    let quantity = 1;
    let rest = normPart;

    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10);
      rest = qtyMatch[2].trim();
    }

    const priceMatch = rest.match(/^(.*?)(?:\s+de\s+(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*(?:reais)?)$/i);
    let targetPrice = null;
    let productName = rest;

    if (priceMatch) {
      productName = priceMatch[1].trim();
      targetPrice = parseFloat(priceMatch[2].replace(',', '.'));
    }

    if (productName) {
      items.push({ quantity, productName, targetPrice });
    }
  }

  return items;
}

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
   * @param {string} rawMessage
   * @param {Object} [context]
   * @param {Object} [context.pendingOrder]
   * @param {Object} [context.customerProfile]
   * @returns {{ intent: string, matchedProduct?: Object, suggestedProducts?: Array<Object>, orderItems?: Array<Object>, updatedFields?: Object, ambiguousProduct?: Object }}
   */
  route(rawMessage, context = {}) {
    if (!rawMessage || typeof rawMessage !== 'string' || !rawMessage.trim()) {
      return { intent: INTENTS.GENERAL_CHAT };
    }

    const normalized = normalizeText(rawMessage);

    // 0. Confirmação / Fechamento de Pedido
    if (ORDER_CONFIRMATION_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return { intent: INTENTS.ORDER_CONFIRMATION };
    }

    // 1. Atualização de Detalhes de Pedido Pendente (Forma de pagamento ou Endereço)
    const isPaymentUpdate = PAYMENT_UPDATE_PATTERNS.some((p) => p.test(normalized));
    const isAddressUpdate = ADDRESS_UPDATE_PATTERNS.some((p) => p.test(normalized));
    if ((isPaymentUpdate || isAddressUpdate) && context.pendingOrder) {
      const updatedFields = {};
      if (isPaymentUpdate) {
        if (/debito/i.test(normalized)) updatedFields.paymentMethod = 'Cartão de Débito';
        else if (/credito/i.test(normalized)) updatedFields.paymentMethod = 'Cartão de Crédito';
        else if (/pix/i.test(normalized)) updatedFields.paymentMethod = 'PIX';
        else if (/dinheiro/i.test(normalized)) updatedFields.paymentMethod = 'Dinheiro';
      }
      if (isAddressUpdate) {
        const addrMatch = rawMessage.match(/(?:entregar em|entrega em|endereco|na rua|no endereco)\s*:?\s*(.*)$/i);
        if (addrMatch && addrMatch[1]) {
          updatedFields.deliveryAddress = addrMatch[1].trim();
        } else {
          updatedFields.deliveryAddress = rawMessage.trim();
        }
      }
      return {
        intent: INTENTS.UPDATE_ORDER_DETAILS,
        updatedFields,
      };
    }

    // 2. Pedido de Compra Estruturado (ex: "Manda pra mim 3 alface crespa", "3 alface de 8, 3 rucula e 5 cebolinha")
    const orderItems = parseOrderItems(rawMessage);
    if (orderItems.length > 0) {
      const resolvedItems = [];
      let ambiguousProduct = null;

      for (const item of orderItems) {
        const product = this.catalogRepository.findProductByName(item.productName);
        if (product) {
          if (!item.targetPrice && product.prices.length > 1) {
            const customerPref = context.customerProfile?.preferredItems?.[normalizeText(product.canonicalName)];
            if (customerPref && product.prices.includes(customerPref)) {
              item.targetPrice = customerPref;
            } else {
              ambiguousProduct = product;
            }
          }

          resolvedItems.push({
            product,
            quantity: item.quantity,
            targetPrice: item.targetPrice || product.prices[0],
          });
        }
      }

      if (ambiguousProduct) {
        return {
          intent: INTENTS.ASK_SIZE_CONFIRMATION,
          ambiguousProduct,
          orderItems,
        };
      }

      if (resolvedItems.length > 0) {
        return {
          intent: INTENTS.PLACE_ORDER,
          orderItems: resolvedItems,
        };
      }
    }

    // 3. Pedido de fotos do Google Drive
    if (PHOTO_TRIGGER_PATTERNS.some((pattern) => pattern.test(normalized))) {
      const cleaned = cleanConversationalPrefixes(normalized);
      const matchedProduct = this.catalogRepository.findProductByName(cleaned);
      const categoryMatches = this.findMatchingCategoryOrProducts(cleaned);
      return {
        intent: INTENTS.REQUEST_PHOTOS,
        matchedProduct: matchedProduct || null,
        suggestedProducts: categoryMatches,
      };
    }

    // 4. Consulta de Produto ou Categoria
    const cleaned = cleanConversationalPrefixes(rawMessage);
    const isCategory = this.catalogRepository.isCategoryOrSubcategory(cleaned);

    // Se NÃO for categoria e casar com um produto específico (ex: "Vocês tem mini cabra?", "Tem cebolinha?")
    if (!isCategory && cleaned.length >= 3) {
      const matchedProduct = this.catalogRepository.findProductByName(cleaned);
      if (matchedProduct) {
        return {
          intent: INTENTS.DIRECT_PRICE,
          matchedProduct,
        };
      }
    }

    // Se for categoria ou pergunta aberta ampla (ex: "Vocês tem palmeiras?", "Quais frutas tem?")
    const categoryMatches = this.findMatchingCategoryOrProducts(cleaned.length >= 3 ? cleaned : normalized);
    if (categoryMatches.length > 0) {
      return {
        intent: INTENTS.CONSULTATIVE_SALES,
        suggestedProducts: categoryMatches,
      };
    }

    // Fallback: Diálogo consultivo
    return {
      intent: INTENTS.CONSULTATIVE_SALES,
      suggestedProducts: [],
    };
  }

  findMatchingCategoryOrProducts(normalizedText) {
    const words = normalizedText.split(' ').filter((w) => w.length > 3);
    for (const word of words) {
      const singularWord = toSingular(word);
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
  cleanConversationalPrefixes,
  parseOrderItems,
  isOrderMessage,
};
