/**
 * Botanical Consultant Service - Conflora AI
 * Provides intelligent botanical advice, plant care tips, and relevant product recommendations
 * tailored for the climate of Mineiros - GO and the Brazilian Cerrado region.
 */

const Logger = require('../shared/logger');

const BOTANICAL_INTENTS = {
  SOMBRA: {
    keywords: ['sombra', 'meia-sombra', 'pouca luz', 'pouco sol', 'interior', 'sala', 'quarto', 'escritorio', 'dentro de casa'],
    advice: 'Para ambientes de sombra ou meia-sombra (como salas e varandas cobertas), o segredo é a iluminação indireta abundante e solo com boa drenagem. Evite encharcar as raízes; regue apenas quando a camada superior do substrato estiver seca ao toque.',
    catalogFilter: (p) => {
      const text = `${p.descricao || p.name || ''} ${p.subcategoria || p.subcategory || ''} ${p.categoria || p.category || ''}`.toLowerCase();
      return /sombra|jiboia|zamioculca|lirio|samambaia|avenca|raphis|anturio|costela|begonia|orquidea|maranta|calathea/i.test(text);
    },
  },
  FRUTIFERAS_VASOS: {
    keywords: ['frutifera', 'fruta', 'vaso', 'vasos', 'pe de fruta', 'jabuticaba', 'limao', 'amora', 'acerola', 'roma', 'pitanga'],
    advice: 'Mudas frutíferas em vasos precisam de vasos com pelo menos 40 a 60 litros, furos de drenagem com manta bidim e argila expandida, além de pelo menos 4 a 6 horas de sol direto por dia. Recomendamos adubação rica em Fósforo e Potássio a cada 45 dias para estimular floração e frutificação.',
    catalogFilter: (p) => {
      const text = `${p.descricao || p.name || ''} ${p.subcategoria || p.subcategory || ''} ${p.categoria || p.category || ''}`.toLowerCase();
      return /frutifer|jabuticaba|limao|amora|acerola|roma|pitanga|goiaba|maracuja|caju|manga|laranja/i.test(text);
    },
  },
  HORTA_TEMPEROS: {
    keywords: ['horta', 'tempero', 'ervas', 'manjericao', 'alecrim', 'hortela', 'cebolinha', 'salsa', 'pimenta', 'oregano', 'coentro'],
    advice: 'Temperos e hortaliças necessitam de pelo menos 4 a 5 horas de sol pleno diário para desenvolverem seus óleos essenciais e aroma marcante. Regas regulares preferencialmente pela manhã bem cedo. Não deixe água acumular no pratinho!',
    catalogFilter: (p) => {
      const text = `${p.descricao || p.name || ''} ${p.subcategoria || p.subcategory || ''} ${p.categoria || p.category || ''}`.toLowerCase();
      return /horta|tempero|alecrim|manjericao|hortela|cebolinha|salsa|pimenta|oregano|tomilho|ervas/i.test(text);
    },
  },
  PET_FRIENDLY: {
    keywords: ['pet', 'pets', 'gato', 'gatos', 'cachorro', 'caes', 'venenosa', 'toxica', 'segura para bicho', 'animal'],
    advice: 'Para tutores de pets (cães e gatos), plantas como Calatéias, Marantas, Orquídeas e Fitônias são 100% seguras e não tóxicas. Evite Comigo-Ninguém-Pode, Costela-de-Adão e Espada-de-São-Jorge ao alcance direto dos seus bichinhos.',
    catalogFilter: (p) => {
      const text = `${p.descricao || p.name || ''} ${p.subcategoria || p.subcategory || ''} ${p.categoria || p.category || ''}`.toLowerCase();
      return /maranta|calathea|orquidea|fitonia|peperomia|samambaia|bambu/i.test(text);
    },
  },
  ADUBOS_INSUMOS: {
    keywords: ['adubo', 'substrato', 'terra', 'fertilizante', 'npk', 'calcario', 'humus', 'torta de mamona', 'farinha de ossos'],
    advice: 'Para o solo de Mineiros e Cerrado, a correção de acidez com calcário e enriquecimento com matéria orgânica (húmus de minhoca e torta de mamona) produz resultados espetaculares. Em vasos e floreiras, use substrato aerado misturado com casca de arroz carbonizada.',
    catalogFilter: (p) => {
      const text = `${p.descricao || p.name || ''} ${p.subcategoria || p.subcategory || ''} ${p.categoria || p.category || ''}`.toLowerCase();
      return /adubo|substrato|terra|fertilizante|npk|humus|calcario|insumo/i.test(text);
    },
  },
  SOL_PLENO: {
    keywords: ['sol', 'sol pleno', 'calor', 'cerrado', 'jardim externo', 'calcada', 'resistente', 'seca', 'cacto', 'suculenta'],
    advice: 'No clima quente e ensolarado do sudoeste goiano, espécies que toleram sol pleno forte incluem Rosa do Deserto, Cactos, Suculentas, Alamandas e Palmeiras Nativas. Mantenha cobertura morta (casca de pinus) para proteger o solo contra o calor extremo.',
    catalogFilter: (p) => {
      const text = `${p.descricao || p.name || ''} ${p.subcategoria || p.subcategory || ''} ${p.categoria || p.category || ''}`.toLowerCase();
      return /sol|rosa do deserto|cacto|suculenta|alamanda|bougainville|palmeira|ipe/i.test(text);
    },
  },
};

class BotanicalConsultantService {
  /**
   * Identifica a intenção e tópicos botânicos a partir da mensagem do usuário.
   * @param {string} userQuery
   * @returns {string|null}
   */
  static detectBotanicalIntent(userQuery) {
    if (!userQuery || typeof userQuery !== 'string') {
      return null;
    }
    const normalized = userQuery
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    for (const [intentKey, config] of Object.entries(BOTANICAL_INTENTS)) {
      for (const kw of config.keywords) {
        const normKw = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalized.includes(normKw)) {
          return intentKey;
        }
      }
    }
    return null;
  }

  /**
   * Processa a consulta botânica usando o catálogo da Conflora e IA generativa (se disponível).
   * @param {Object} params
   * @param {string} params.query
   * @param {Array} [params.history]
   * @param {Array} params.catalogProducts
   * @param {Object} [params.agentService]
   * @returns {Promise<{ reply: string, recommendations: Array }>}
   */
  static async consult({ query, history: _history = [], catalogProducts = [], agentService = null }) {
    if (!query || typeof query !== 'string') {
      return {
        reply: 'Olá! Como posso ajudar você a cuidar do seu jardim ou escolher as melhores mudas hoje?',
        recommendations: [],
      };
    }

    const intent = this.detectBotanicalIntent(query);
    const intentConfig = intent ? BOTANICAL_INTENTS[intent] : null;

    // Filtra produtos relevantes no catálogo real da Conflora
    let matchedProducts = [];
    if (intentConfig && typeof intentConfig.catalogFilter === 'function') {
      matchedProducts = catalogProducts.filter(intentConfig.catalogFilter);
    }

    // Busca textual complementar no catálogo
    const cleanTokens = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const tokenMatches = catalogProducts.filter((p) => {
      const prodText = `${p.descricao || p.name || ''} ${p.subcategoria || p.subcategory || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return cleanTokens.some((token) => prodText.includes(token));
    });

    // Mescla e remove duplicados
    const combinedMap = new Map();
    for (const p of [...matchedProducts, ...tokenMatches]) {
      if (p && p.id && !combinedMap.has(p.id)) {
        combinedMap.set(p.id, p);
      }
    }

    // Se ainda não encontrou nenhum produto específico, seleciona os mais populares do viveiro
    let recommendedProducts = Array.from(combinedMap.values()).slice(0, 4);
    if (recommendedProducts.length === 0 && catalogProducts.length > 0) {
      recommendedProducts = catalogProducts.slice(0, 3);
    }

    // Mapeia produtos com formato enxuto para o card do chat
    const formattedRecommendations = recommendedProducts.map((p) => {
      const price = Number(p.valor_num || p.price || 0);
      const img = (p.images && p.images[0]) || p.imageUrl || p.imageurl || 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=800';
      return {
        id: p.id,
        name: p.descricao || p.name || 'Muda Conflora',
        category: p.subcategoria || p.subcategory || p.categoria || p.category || 'Mudas & Plantas',
        price,
        formattedPrice: `R$ ${price.toFixed(2).replace('.', ',')}`,
        imageUrl: img,
        unit: p.unit || p.unidade || 'un',
        stock: p.stockQuantity ?? p.estoque ?? 20,
      };
    });

    // Tenta gerar resposta personalizada com o Gemini se o client estiver ativo
    let aiReply = null;
    if (agentService && typeof agentService.getAiClient === 'function') {
      try {
        const client = agentService.getAiClient();
        if (client && client.models) {
          const prompt = `
Você é a CONFLORA AI, consultora botânica e paisagista especialista da Conflora Horta e Viveiro em Mineiros - GO (região do Cerrado).
Responda ao cliente com simpatia, naturalidade e dicas práticas (luz solar, rega, substrato, cuidados no calor do cerrado).
Pergunta do cliente: "${query}"

Produtos disponíveis em estoque no nosso catálogo para essa necessidade:
${formattedRecommendations.map((p) => `- ${p.name} (${p.category}) por ${p.formattedPrice}`).join('\n')}

DIRETRIZES:
1. Escreva um parágrafo conciso, acolhedor e com autoridade técnica de viveiro (máximo 3-4 frases explicativas).
2. Destaque as opções ideais que recomendamos e como cultivá-las com sucesso.
3. Não invente produtos que não existem no viveiro.
`;
          const response = await client.models.generateContent({
            model: agentService.modelName || 'gemini-2.5-flash',
            contents: prompt,
          });

          if (response && response.text) {
            aiReply = response.text.trim();
          }
        }
      } catch (err) {
        Logger.info('Consultoria Botânica Conflora: utilizando base botânica especializada do viveiro', {
          reason: err && err.message ? err.message.slice(0, 80) : 'indisponível'
        });
      }
    }

    // Resposta contextual baseada no conhecimento botânico da Conflora
    if (!aiReply) {
      if (intentConfig) {
        aiReply = `🌿 **Dica Especial Conflora:** ${intentConfig.advice}\n\nSeparamos as melhores opções do nosso viveiro que se adaptam com facilidade ao clima de Mineiros - GO:`;
      } else {
        aiReply = `🌿 **Consultoria Conflora:** Encontrei excelentes opções no nosso viveiro para a sua busca! Aqui estão plantas saudáveis, aclimatadas e prontas para o plantio:`;
      }
    }

    return {
      success: true,
      reply: aiReply,
      intent: intent || 'GERAL',
      recommendations: formattedRecommendations,
    };
  }
}

module.exports = { BotanicalConsultantService, BOTANICAL_INTENTS };
