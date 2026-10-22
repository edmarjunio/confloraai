const config = require('../config/env');
const Logger = require('../shared/logger');
const { formatCurrency } = require('../shared/string.util');

let genAiModule = null;
function getGenAI() {
  if (!genAiModule) {
    try {
      genAiModule = require('@google/genai');
    } catch {
      return null;
    }
  }
  return genAiModule;
}

const { getProductCareDetails } = require('../catalog/product-care');

class AgentService {
  /**
   * @param {Object} [options]
   * @param {Object} [options.aiClient]
   */
  constructor({ aiClient = null } = {}) {
    this.aiClient = aiClient;
    this.modelName = config.gemini.model || 'gemini-3.8-flash';

    if (!this.aiClient && process.env.NODE_ENV !== 'test') {
      this.getAiClient();
    }
  }

  getAiClient() {
    if (this.aiClient) {
      return this.aiClient;
    }
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    const GenAI = getGenAI();
    if (GenAI && GenAI.GoogleGenAI) {
      try {
        const apiKey = process.env.GEMINI_API_KEY || config.gemini.apiKey;
        if (apiKey) {
          this.aiClient = new GenAI.GoogleGenAI({ apiKey });
        } else {
          this.aiClient = new GenAI.GoogleGenAI({
            vertexai: true,
            project: config.gcp.projectId,
            location: config.gemini.location || 'southamerica-east1',
          });
        }
      } catch (err) {
        Logger.warn('Aviso: Inicialização da IA será feita na primeira requisição', { error: err.message });
      }
    }
    return this.aiClient;
  }

  /**
   * Constrói o System Instruction dinâmico para garantir respostas diretas, objetivas e no ritmo do cliente.
   */
  buildSystemPrompt({ mode, targetProduct = null, suggestedProducts = [] }) {
    let specificDirective = '';

    if (mode === 'DIRECT_PRICE' && targetProduct) {
      let priceDetails = '';
      if (targetProduct.variations && targetProduct.variations.length > 0) {
        priceDetails = targetProduct.variations
          .map((v) => `${v.name}: ${formatCurrency(v.price)}`)
          .join(' | ');
      } else if (targetProduct.prices && targetProduct.prices.length > 1) {
        priceDetails = targetProduct.prices
          .map((p) => formatCurrency(p))
          .join(' a ');
      } else {
        const pVal = (targetProduct.prices && targetProduct.prices[0]) || targetProduct.price || 0;
        priceDetails = formatCurrency(pVal);
      }

      specificDirective = `
PRODUTO IDENTIFICADO: ${targetProduct.canonicalName || targetProduct.name}
PREÇO OFICIAL DO CATÁLOGO: ${priceDetails}

INSTRUÇÕES (SEJA DIRETO, OBJETIVO E RÁPIDO):
1. Confirme que temos o item e informe o valor de forma clara e educada.
2. Responda em no máximo 1 ou 2 parágrafos curtos (estilo conversa real e ágil de WhatsApp).
3. NÃO envie textos longos, palestras ou dicas de cuidados não solicitadas. O cliente dita o ritmo da conversa.
4. Pergunte de forma simples: "Você prefere entrega aqui em Mineiros ou retirar na loja?"
5. Feche com: "(Se preferir falar com um atendente, é só avisar!)"
`;
    } else if (mode === 'CONSULTATIVE_SALES') {
      let catalogText = '';
      if (suggestedProducts.length > 0) {
        catalogText = suggestedProducts
          .slice(0, 5)
          .map((p) => {
            const prices = p.prices ? p.prices.map((v) => formatCurrency(v)).join(' a ') : formatCurrency(p.price || 0);
            return `• ${p.canonicalName || p.name}: ${prices}`;
          })
          .join('\n');
      }

      specificDirective = `
OPÇÕES DISPONÍVEIS NO CATÁLOGO:
${catalogText || 'Nenhum item correspondente encontrado no momento.'}

INSTRUÇÕES (SEJA DIRETO, OBJETIVO E RÁPIDO):
1. Se houver opções acima, cite diretamente as principais com seus respectivos valores (máximo 1 a 2 parágrafos curtos).
2. Se não houver o item no catálogo, explique com gentileza e simplicidade que não temos esse item disponível no momento.
3. NÃO envie textos longos. O cliente dita o ritmo da conversa.
4. Pergunte com simplicidade se prefere entrega ou retirada.
5. Feche com: "(Se preferir falar com um atendente, é só avisar!)"
`;
    }

    return `
Você é o atendente da Conflora Horta e Viveiro & Agromadeiras em Mineiros - GO no WhatsApp.
Você atende clientes de forma educada, ágil e MUITO OBJETIVA.

REGRAS:
1. Respostas curtas e diretas: NUNCA mande textão ou parágrafos longos. Seja breve (1 a 2 parágrafos curtos no máximo).
2. O cliente dita o ritmo: responda apenas ao que foi perguntado. Se ele perguntou se tem e o preço, responda se tem, o valor e pergunte se quer retirar ou entrega. Não dê dicas de cultivo ou cuidados a menos que o cliente pergunte especificamente.
3. Jamais invente preços ou produtos fora do catálogo fornecido.
4. Finalize sempre de forma leve com: "(Se preferir falar com um atendente, é só me avisar!)"

${specificDirective}
`.trim();
  }

  /**
   * Gera a resposta do Gemini para o cliente.
   * @param {Object} params
   * @returns {Promise<string>}
   */
  async generateResponse({
    userMessage,
    history = [],
    mode = 'GENERAL_CHAT',
    targetProduct = null,
    suggestedProducts = [],
    customerName: _customerName = '',
  }) {
    const systemInstruction = this.buildSystemPrompt({ mode, targetProduct, suggestedProducts });

    const client = this.getAiClient();
    if (client && client.models && typeof client.models.generateContent === 'function') {
      const candidateModels = Array.from(new Set([this.modelName, 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.5-flash'])).filter(Boolean);
      const contents = [];

      // Histórico de conversas prévias
      for (const msg of (Array.isArray(history) ? history : []).slice(-6)) {
        contents.push({
          role: ['assistant', 'model'].includes(msg?.role) ? 'model' : 'user',
          parts: [{ text: String(msg?.text || '').slice(0, 600) }],
        });
      }

      // Mensagem atual
      contents.push({
        role: 'user',
        parts: [{ text: String(userMessage || '').slice(0, 800) }],
      });

      for (const modelCandidate of candidateModels) {
        try {
          const response = await client.models.generateContent({
            model: modelCandidate,
            contents,
            config: {
              systemInstruction,
              temperature: 0.2,
              maxOutputTokens: 180,
            },
          });

          let replyText = response.text?.trim();
          if (replyText) {
            if (!replyText.toLowerCase().includes('atendente')) {
              replyText += '\n\n(Se preferir falar com um atendente, é só me avisar!)';
            }
            return replyText;
          }
        } catch (error) {
          Logger.warn(`Falha na API com modelo ${modelCandidate}, tentando próximo...`, { error: error.message });
        }
      }
    }

    const standardClosing = '\n\n(Se preferir falar com um atendente, é só me avisar!)';

    // Fallback inteligente caso a IA esteja offline ou em testes sem conexão
    if (mode === 'DIRECT_PRICE' && targetProduct) {
      const name = targetProduct.canonicalName || targetProduct.name || 'Produto';
      if (targetProduct.variations && targetProduct.variations.length > 0) {
        const varText = targetProduct.variations
          .map((v) => `${v.name} por ${formatCurrency(v.price)}`)
          .join(' e ');
        return `Temos sim! Trabalhamos com ${name} aqui na Conflora: ${varText}.\n\nVocê prefere entrega aqui em Mineiros ou retirar na loja?` + standardClosing;
      }
      const prices = targetProduct.prices && targetProduct.prices.length > 0
        ? targetProduct.prices.map((p) => formatCurrency(p)).join(' e ')
        : formatCurrency(targetProduct.price || 0);
      return `Temos sim! O item ${name} está a partir de ${prices}.\n\nVocê prefere entrega aqui em Mineiros ou retirar na loja?` + standardClosing;
    }

    if (mode === 'CONSULTATIVE_SALES' && suggestedProducts.length > 0) {
      const topNames = suggestedProducts.slice(0, 3).map((p) => {
        const pr = p.prices ? p.prices.map(formatCurrency).join(' a ') : formatCurrency(p.price || 0);
        return `• ${p.canonicalName || p.name}: ${pr}`;
      }).join('\n');
      return `Olá! Temos sim essas opções disponíveis:\n${topNames}\n\nGostaria de garantir algum deles para retirada ou entrega?` + standardClosing;
    }

    return `Olá! Como posso ajudar você hoje na Conflora?` + standardClosing;
  }
}

module.exports = {
  AgentService,
};
