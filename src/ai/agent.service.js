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
  constructor({ aiClient = null } = {}) {
    this.aiClient = aiClient;
    this.modelName = config.gemini.model || 'gemini-2.5-flash';

    if (!this.aiClient && process.env.NODE_ENV !== 'test') {
      const GenAI = getGenAI();
      if (GenAI && GenAI.GoogleGenAI) {
        try {
          if (process.env.GEMINI_API_KEY) {
            this.aiClient = new GenAI.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          } else {
            this.aiClient = new GenAI.GoogleGenAI({
              vertexAI: true,
              project: config.gcp.projectId,
              location: config.gemini.location || 'southamerica-east1',
            });
          }
        } catch (err) {
          Logger.warn('Aviso: Inicializacao da IA sera feita na primeira requisicao', { error: err.message });
        }
      }
    }
  }

  buildSystemPrompt({ mode, targetProduct = null, suggestedProducts = [], domain = 'PLANTAS' }) {
    let specificDirective = '';

    if (mode === 'DIRECT_PRICE' && targetProduct) {
      const prices = targetProduct.prices.map((p) => formatCurrency(p)).join(' e ');
      const descLine = targetProduct.descriptionAi ? `- Descrição técnica: ${targetProduct.descriptionAi}` : '';
      specificDirective = `
MODO DE ATENDIMENTO: RESPOSTA DIRETA DE PREÇO (OBJETIVA E SEM ENROLAÇÃO)
- O cliente perguntou o valor específico de: "${targetProduct.canonicalName}".
- Preços oficiais do catálogo: ${prices}. Categoria: ${targetProduct.category || 'Geral'}.
${descLine}
DIRETRIZES:
1. Vá DIRETO ao ponto! Comece já informando os valores com naturalidade e simpatia.
2. NÃO fique de conversinha fiada ou fazendo perguntas antes de passar o preço. O cliente quer saber o valor primeiro.
3. Se houver variações de preço, explique com clareza o motivo (ex: tamanho/porte da muda ou sexo/raça).
4. Após passar os valores, pergunte com naturalidade se ele gostaria de ver fotos das opções disponíveis ou qual porte/modelo prefere.
`;
    } else if (mode === 'CONSULTATIVE_SALES') {
      let catalogText = '';
      if (suggestedProducts.length > 0) {
        catalogText = suggestedProducts
          .map((p) => `• ${p.canonicalName}: ${p.prices.map((v) => formatCurrency(v)).join(' a ')} (${p.subcategory || p.category})`)
          .join('\n');
      }

      if (domain === 'PETS') {
        specificDirective = `
MODO DE ATENDIMENTO: CONSULTORIA DE PETS E ANIMAIS (AVES, ROEDORES, PEQUENOS MAMÍFEROS)
- O cliente perguntou sobre pets (ex: porquinho da índia, hamster, calopsita, aves).
DIRETRIZES:
1. NUNCA pergunte sobre jardim, vaso, sol ou sombra! Isso é exclusivo de plantas.
2. Apresente com simpatia as raças, pelagens e opções disponíveis com seus respectivos valores reais.
   Exemplo para Porquinho da Índia: mencione as raças que temos (Abissínio com pelo arrepiado, Peruano com pelo longo, Inglês/Comum com pelo curto), e que temos opções de machos e fêmeas.
3. Pergunte com agilidade e cordialidade: "Você procura alguma raça ou sexo específico (macho ou fêmea)? Temos algumas opções lindas aqui na loja e posso te mandar fotos se quiser!"
4. Conduza com atenção para tirar dúvidas de gaiola/ração e fechar a venda.

PRODUTOS REAIS DO CATÁLOGO:
${catalogText || 'Consulte o atendente.'}
`;
      } else {
        specificDirective = `
MODO DE ATENDIMENTO: CONSULTORIA DE PLANTAS E JARDINAGEM (SOL VS SOMBRA)
- O cliente perguntou sobre plantas ou palmeiras de forma ampla (ex: "quero uma palmeira", "vocês têm palmeiras?").
DIRETRIZES:
1. Atue como um consultor especialista e atencioso da Conflora Horta e Viveiro em Mineiros - GO.
2. Como temos opções ativas tanto para sol pleno quanto para sombra/interior no viveiro, pergunte com naturalidade e clareza:
   "Você quer pra colocar no jardim ou dentro de casa? Temos algumas opções disponíveis na nossa loja!"
3. Não vomite a lista inteira. Cite 2 ou 3 exemplos mais procurados:
   - Para sol/jardim: Palmeira Rabo de Raposa, Palmeira Azul, etc.
   - Para sombra/dentro de casa: Ráfia, Areca Bambu.
4. Desvende com agilidade a necessidade do cliente sem parecer um robô que repete mensagens prontas.

PRODUTOS REAIS DO CATÁLOGO:
${catalogText || 'Consulte o catálogo da Conflora.'}
`;
      }
    } else if (mode === 'ORDER_CONFIRMATION') {
      specificDirective = `
MODO DE ATENDIMENTO: CONFIRMAÇÃO DE PEDIDO
- O cliente está confirmando a compra.
- Responda calorosamente, confirme o pedido com entusiasmo e instrua sobre o envio do comprovante PIX com cordialidade.
`;
    }

    return `
Você é o atendente e consultor de vendas oficial da Conflora Horta e Viveiro & Agromadeiras em Mineiros - Goiás.
Você atende clientes no WhatsApp de forma humana, acolhedora, confiável e profissional.

Regras Invioláveis de Credibilidade:
1. Jamais pareça um robô programado. Gere uma resposta única, fluida e personalizada para cada cliente.
2. Jamais invente preços, espécies ou informações que não estejam no catálogo fornecido.
3. Responda no tom acolhedor característico de um viveiro em Goiás: educado, ágil, seguro e prestativo.
4. Mantenha as mensagens no tamanho ideal para leitura rápida no celular (2 a 4 parágrafos curtos).

${specificDirective}
`.trim();
  }

  async generateResponse({
    userMessage,
    history = [],
    mode = 'GENERAL_CHAT',
    targetProduct = null,
    suggestedProducts = [],
    domain = 'PLANTAS',
    customerName = '',
  }) {
    const systemInstruction = this.buildSystemPrompt({ mode, targetProduct, suggestedProducts, domain });

    if (this.aiClient && this.aiClient.models && typeof this.aiClient.models.generateContent === 'function') {
      try {
        const contents = [];

        for (const msg of history) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.text }],
          });
        }

        contents.push({
          role: 'user',
          parts: [{ text: userMessage }],
        });

        const response = await this.aiClient.models.generateContent({
          model: this.modelName,
          contents,
          config: {
            systemInstruction,
            temperature: 0.5,
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

    if (mode === 'DIRECT_PRICE' && targetProduct) {
      const prices = targetProduct.prices.map((p) => formatCurrency(p)).join(' e ');
      return 'Olá! A nossa ' + targetProduct.canonicalName + ', temos a partir de ' + prices + ' dependendo do porte da muda. Gostaria que eu te mande fotos das que estão disponíveis aqui no viveiro?';
    }

    if (mode === 'CONSULTATIVE_SALES') {
      if (domain === 'PETS') {
        return 'Olá! Temos ótimas opções aqui na Conflora, como porquinho da índia abissínio (pelo arrepiado), peruano (pelo longo) e comum, tanto machos quanto fêmeas. Você procura alguma raça específica ou gostaria de fotos dos que temos hoje?';
      }
      return 'Olá! Temos excelentes opções disponíveis na nossa loja! Você quer pra colocar no jardim ou dentro de casa?';
    }

    return 'Olá! Seja muito bem-vindo à Conflora Horta e Viveiro 🌱. Como posso te ajudar hoje?';
  }
}

module.exports = {
  AgentService,
};
