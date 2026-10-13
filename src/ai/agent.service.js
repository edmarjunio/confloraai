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
    this.modelName = config.gemini.model || 'gemini-2.5-flash';

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
            vertexAI: true,
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
   * Constrói o System Instruction dinâmico para garantir respostas 100% naturais, educativas e com vendas consultivas.
   */
  buildSystemPrompt({ mode, targetProduct = null, suggestedProducts = [] }) {
    let specificDirective = '';

    if (mode === 'DIRECT_PRICE' && targetProduct) {
      let priceDetails = '';
      if (targetProduct.variations && targetProduct.variations.length > 0) {
        priceDetails = targetProduct.variations
          .map((v) => `• ${v.name}: ${formatCurrency(v.price)}`)
          .join('\n');
      } else if (targetProduct.prices && targetProduct.prices.length > 1) {
        priceDetails = targetProduct.prices
          .map((p) => `• Opção: ${formatCurrency(p)}`)
          .join('\n');
      } else {
        const pVal = (targetProduct.prices && targetProduct.prices[0]) || targetProduct.price || 0;
        priceDetails = formatCurrency(pVal);
      }

      const care = getProductCareDetails(targetProduct);

      specificDirective = `
MODO DE ATENDIMENTO: RESPOSTA DIRETA DE PREÇO, CUIDADOS E CONDUÇÃO À COMPRA
- O cliente perguntou sobre: "${targetProduct.canonicalName || targetProduct.name}".
- Categoria: ${targetProduct.category || 'Geral'} -> ${targetProduct.subcategory || ''}.
- PREÇOS OFICIAIS DO CATÁLOGO:
${priceDetails}

DADOS TÉCNICOS & CUIDADOS DO FIRESTORE (CONSULTA DINÂMICA):
• Cuidados Básicos: ${care.cuidados_basicos}
• Ambiente Ideal: ${care.ambiente_ideal}
• Dicas de Armazenamento: ${care.dicas_armazenamento}
• Durabilidade: ${care.durabilidade}
• Gancho de Cross-sell Sugerido: ${care.crossSellSugestao}

REGRA DE OURO SOBRE O CATÁLOGO:
O catálogo acima é a VERDADE ABSOLUTA sobre o estoque da Conflora em Mineiros - GO. Se o produto está no catálogo, nós TEMOS o produto disponível para venda.

DIRETRIZES DA RESPOSTA:
1. Comece confirmando a disponibilidade e informando os valores com clareza, simpatia e tom acolhedor de Goiás.
2. Forneça uma explicação CURTA E EDUCATIVA (1 a 2 frases no máximo) sobre os cuidados, ambiente ideal ou durabilidade do item, transmitindo autoridade e carinho no atendimento.
3. Crie um gancho natural para CROSS-SELL sugerindo um item complementar do viveiro (ex: "Para essa planta, muitos clientes levam também nosso adubo orgânico especial para fortalecer as folhas").
4. Conduza rapidamente o cliente de volta ao FLUXO DE COMPRA com o mínimo de mensagens/cliques (ex: "Gostaria que eu separe uma unidade para você retirar na loja ou prefere que entreguemos no seu endereço em Mineiros?").
`;
    } else if (mode === 'CONSULTATIVE_SALES') {
      let catalogText = '';
      if (suggestedProducts.length > 0) {
        catalogText = suggestedProducts
          .map((p) => {
            const care = getProductCareDetails(p);
            const prices = p.prices ? p.prices.map((v) => formatCurrency(v)).join(' a ') : formatCurrency(p.price || 0);
            return `• ${p.canonicalName || p.name}: ${prices} (${p.subcategory || p.category}) | Cuidados: ${care.cuidados_basicos.slice(0, 60)}...`;
          })
          .join('\n');
      }

      specificDirective = `
MODO DE ATENDIMENTO: CONSULTORIA DE VENDAS ATIVA COM EDUCAÇÃO BOTÂNICA/AGRO
- O cliente fez uma pergunta aberta ou de categoria (ex: "Vocês têm palmeiras?", "Quais frutas frescas têm?", "Móveis rústicos").
DIRETRIZES:
1. Responda como consultor atencioso e especialista da Conflora Horta e Viveiro & Agromadeiras em Mineiros - GO.
2. Destaque 2 ou 3 das melhores opções disponíveis e dê uma dica rápida sobre o ambiente ideal de cultivo/armazenamento.
3. Crie gancho de cross-sell e conduza diretamente à decisão de compra com uma pergunta objetiva (ex: "Você prefere para entrega ou retirada aqui no viveiro?").
4. Seja humano, caloroso e ágil.

PRODUTOS REAIS DO CATÁLOGO:
${catalogText || 'Consulte os produtos da loja.'}
`;
    }

    return `
Você é o atendente e consultor de vendas oficial da Conflora Horta e Viveiro & Agromadeiras em Mineiros - Goiás.
Você atende clientes no WhatsApp de forma humana, acolhedora, confiável e profissional.

Regras Invioláveis de Credibilidade:
1. Jamais pareça um robô programado. Gere uma resposta única, fluida e personalizada para cada cliente.
2. Jamais invente preços, espécies ou informações que não estejam no catálogo fornecido.
3. Responda no tom acolhedor de Goiás: educado, ágil, seguro e prestativo.
4. Mantenha as mensagens no tamanho ideal para leitura rápida no celular (2 a 3 parágrafos curtos).

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
      try {
        const contents = [];

        // Histórico de conversas prévias
        for (const msg of history) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.text }],
          });
        }

        // Mensagem atual
        contents.push({
          role: 'user',
          parts: [{ text: userMessage }],
        });

        const response = await client.models.generateContent({
          model: this.modelName,
          contents,
          config: {
            systemInstruction,
            temperature: 0.4,
            maxOutputTokens: 600,
          },
        });

        const replyText = response.text?.trim();
        if (replyText) {
          return replyText;
        }
      } catch (error) {
        Logger.error('Erro na chamada da API do Gemini', error);
      }
    }

    // Fallback inteligente caso a IA esteja offline ou em testes sem conexão
    if (mode === 'DIRECT_PRICE' && targetProduct) {
      const care = getProductCareDetails(targetProduct);
      const name = targetProduct.canonicalName || targetProduct.name || 'Produto';
      if (targetProduct.variations && targetProduct.variations.length > 0) {
        const varText = targetProduct.variations
          .map((v) => `${v.name} por ${formatCurrency(v.price)}`)
          .join(' e ');
        return `Temos sim! Trabalhamos com ${name} aqui na Conflora: ${varText}.\n\n💡 *Dica:* ${care.cuidados_basicos}\n🌿 *Ambiente:* ${care.ambiente_ideal}\n\n${care.crossSellSugestao ? `👉 ${care.crossSellSugestao}\n\n` : ''}Gostaria que eu separe uma unidade para você retirar ou prefere entrega no seu endereço?`;
      }
      const prices = targetProduct.prices && targetProduct.prices.length > 0
        ? targetProduct.prices.map((p) => formatCurrency(p)).join(' e ')
        : formatCurrency(targetProduct.price || 0);
      return `Temos sim! O item ${name} temos a partir de ${prices}.\n\n💡 *Cuidados:* ${care.cuidados_basicos}\n🏡 *Ambiente ideal:* ${care.ambiente_ideal}\n\n${care.crossSellSugestao ? `👉 ${care.crossSellSugestao}\n\n` : ''}Gostaria de garantir o seu agora para retirada ou entrega em Mineiros?`;
    }

    if (mode === 'CONSULTATIVE_SALES' && suggestedProducts.length > 0) {
      const topNames = suggestedProducts.slice(0, 3).map((p) => p.canonicalName || p.name).join(', ');
      return `Olá! Temos excelentes opções disponíveis aqui na Conflora, como ${topNames}.\n\nPara eu te orientar na melhor escolha: você prefere para cultivar em vaso, direto na horta/jardim ou para consumo imediato?`;
    }

    return `Olá! Seja muito bem-vindo à Conflora Horta e Viveiro 🌱. Como posso te ajudar hoje?`;
  }
}

module.exports = {
  AgentService,
};
