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
   * Constrói o System Instruction dinâmico para garantir respostas 100% naturais e contextualizadas.
   */
  buildSystemPrompt({ mode, targetProduct = null, suggestedProducts = [] }) {
    let specificDirective = '';

    if (mode === 'DIRECT_PRICE' && targetProduct) {
      let priceDetails = '';
      if (targetProduct.variations && targetProduct.variations.length > 0) {
        priceDetails = targetProduct.variations
          .map((v) => `• ${v.name}: ${formatCurrency(v.price)}`)
          .join('\n');
      } else if (targetProduct.prices.length > 1) {
        priceDetails = targetProduct.prices
          .map((p) => `• Opção: ${formatCurrency(p)}`)
          .join('\n');
      } else {
        priceDetails = formatCurrency(targetProduct.prices[0] || 0);
      }

      specificDirective = `
MODO DE ATENDIMENTO: RESPOSTA DIRETA DE PREÇO E DISPONIBILIDADE (OBJETIVA, SIMPÁTICA E SEM ENROLAÇÃO)
- O cliente perguntou se temos ou o valor de: "${targetProduct.canonicalName}".
- Categoria: ${targetProduct.category || 'Geral'} -> ${targetProduct.subcategory || ''}.
- PREÇOS OFICIAIS DO CATÁLOGO:
${priceDetails}

REGRA DE OURO SOBRE O CATÁLOGO:
O catálogo acima é a VERDADE ABSOLUTA sobre o estoque da Conflora. Se o produto está no catálogo, nós TEMOS o produto disponível para venda. Desconsidere qualquer mensagem anterior no histórico que tenha dito que não trabalhamos com esse item.

DIRETRIZES:
1. Vá DIRETO ao ponto! Comece confirmando que temos e informando os valores com naturalidade e simpatia (ex: "Temos sim! Trabalhamos com mini cabras aqui na Conflora: o macho está R$ 2.900,00 e a fêmea R$ 3.900,00").
2. Adequar a linguagem ao tipo de produto (animais/pets, plantas, hortaliças, insumos). NÃO pergunte sobre plantio/jardim se o produto for pet ou hortaliça pronta!
3. Se houver variações (ex: macho/fêmea ou portes/tamanhos), informe os valores com clareza.
4. Finalize com no máximo UMA pergunta leve e prestativa (ex: perguntando se gostaria de ver fotos das unidades disponíveis ou se prefere macho ou fêmea).
`;
    } else if (mode === 'CONSULTATIVE_SALES') {
      let catalogText = '';
      if (suggestedProducts.length > 0) {
        catalogText = suggestedProducts
          .map((p) => `• ${p.canonicalName}: ${p.prices.map((v) => formatCurrency(v)).join(' a ')} (${p.subcategory || p.category})`)
          .join('\n');
      }

      specificDirective = `
MODO DE ATENDIMENTO: CONSULTORIA DE VENDAS ATIVA
- O cliente fez uma pergunta aberta ou de categoria ampla (ex: "Vocês têm palmeiras?", "Quais frutíferas têm?").
DIRETRIZES:
1. Responda como um consultor atencioso e especialista da Conflora Horta e Viveiro em Mineiros - GO.
2. NUNCA vomite uma lista enorme de produtos para o cliente. Confirme que temos excelentes opções e cite apenas 2 ou 3 das mais procuradas como exemplo.
3. Faça UMA pergunta estratégica para entender a preferência ou necessidade do cliente de acordo com a categoria solicitada.
4. Seja humano, caloroso e ágil, sem parecer um robô que repete frases prontas.

PRODUTOS REAIS DO CATÁLOGO:
${catalogText || 'Consulte os produtos do viveiro.'}
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
      if (targetProduct.variations && targetProduct.variations.length > 0) {
        const varText = targetProduct.variations
          .map((v) => `${v.name} por ${formatCurrency(v.price)}`)
          .join(' e ');
        return `Temos sim! Trabalhamos com ${targetProduct.canonicalName} aqui na Conflora: ${varText}. Gostaria de ver fotos dos animais disponíveis ou prefere macho ou fêmea?`;
      }
      const prices = targetProduct.prices.map((p) => formatCurrency(p)).join(' e ');
      return `Temos sim! A nossa ${targetProduct.canonicalName} temos a partir de ${prices}. Gostaria que eu te mande fotos das que estão disponíveis aqui no viveiro?`;
    }

    if (mode === 'CONSULTATIVE_SALES' && suggestedProducts.length > 0) {
      const topNames = suggestedProducts.slice(0, 3).map((p) => p.canonicalName).join(', ');
      return `Olá! Temos sim, trabalhamos com ótimas opções aqui na Conflora como ${topNames}.\n\nPara eu te orientar na melhor escolha: você prefere para plantar em vaso ou direto no jardim?`;
    }

    return `Olá! Seja muito bem-vindo à Conflora Horta e Viveiro 🌱. Como posso te ajudar hoje?`;
  }
}

module.exports = {
  AgentService,
};
