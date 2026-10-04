const { GoogleGenAI, Type } = require("@google/genai");
const { config } = require("../config/env");
const { buscarProdutos } = require("../catalog/catalog.repository");
const { prepareOrder, finalizeOrder } = require("../orders/order.service");
const logger = require("../shared/logger");

const ai = new GoogleGenAI({
  vertexai: true,
  project: config.projectId,
  location: config.gemini.location,
  httpOptions: { apiVersion: "v1" },
});

const SYSTEM_INSTRUCTION = `
Você é o atendente virtual e consultor de vendas da CONFLORA HORTA E VIVEIRO no WhatsApp.

MISSÃO: ENTENDER → FILTRAR → RECOMENDAR → CONVERTER.

ESTILO:
- português brasileiro natural, curto, acolhedor e profissional;
- uma pergunta principal por vez;
- não repita perguntas já respondidas;
- não invente informações;
- se perguntarem se você é IA, responda com transparência.

CATÁLOGO:
- use buscar_produtos para produtos, preços, categorias, subcategorias e variações;
- o catálogo é a fonte oficial;
- nunca invente produto, preço, promoção, estoque, variação ou característica;
- STATUS ATIVO significa publicado, não estoque físico confirmado;
- se o cliente pedir todas as opções de um grupo, mostre todas as opções relacionadas;
- se pedir recomendação, consulte todos os produtos relacionados antes de escolher;
- se a busca for ampla e houver muitas possibilidades, faça uma pergunta útil antes de despejar produtos.

VENDAS:
- se o cliente disser exatamente o produto, responda direto;
- quando houver intenção de compra, colete naturalmente: nome, itens e quantidades, entrega ou retirada, endereço se entrega e forma de pagamento;
- só use preparar_pedido quando todos esses dados estiverem disponíveis;
- após preparar_pedido, mostre o resumo exato e pergunte claramente se pode formalizar;
- não finalize por interesse, dúvida ou negociação;
- só use finalizar_pedido após confirmação inequívoca como “sim”, “confirmo”, “pode fechar”, “pode formalizar”, “está certo” ou “fechado”.

PIX:
- se finalizar_pedido retornar PIX, informe exatamente a chave, titular e valor retornados;
- peça o comprovante por foto ou PDF no próprio WhatsApp.

HUMANO:
Use encaminhar_humano quando o cliente pedir pessoa, quando for necessária confirmação humana, negociação fora das regras, estoque físico, informação não confiável ou situação fora do escopo.
O sistema fará o encaminhamento silenciosamente.

FORMATAÇÃO:
- blocos curtos;
- listas quando úteis;
- *negrito* para destaque;
- emojis com moderação;
- não use sempre as mesmas aberturas ou chamadas para ação.
`;

const tools = [
  {
    name: "buscar_produtos",
    description: "Pesquisa produtos reais no catálogo da Conflora.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        termo: { type: Type.STRING, description: "Termo objetivo de busca." },
      },
      required: ["termo"],
    },
  },
  {
    name: "preparar_pedido",
    description:
      "Valida itens, recalcula preços e prepara o pedido para confirmação.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        cliente_nome: { type: Type.STRING },
        itens: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              productId: { type: Type.STRING },
              quantidade: { type: Type.INTEGER },
            },
            required: ["productId", "quantidade"],
          },
        },
        recebimento: { type: Type.STRING, enum: ["entrega", "retirada"] },
        endereco: { type: Type.STRING },
        forma_pagamento: {
          type: Type.STRING,
          enum: ["pix", "dinheiro", "cartao", "outro"],
        },
        observacoes: { type: Type.STRING },
      },
      required: ["cliente_nome", "itens", "recebimento", "forma_pagamento"],
    },
  },
  {
    name: "finalizar_pedido",
    description:
      "Finaliza pedido já preparado somente após confirmação inequívoca.",
    parameters: {
      type: Type.OBJECT,
      properties: { pedidoId: { type: Type.STRING } },
      required: ["pedidoId"],
    },
  },
  {
    name: "encaminhar_humano",
    description: "Interrompe a IA e deixa o atendimento para uma pessoa.",
    parameters: {
      type: Type.OBJECT,
      properties: { motivo: { type: Type.STRING } },
      required: ["motivo"],
    },
  },
];

function productForGemini(product) {
  return {
    id: product.id,
    descricao: product.descricao,
    valor: product.valor,
    valorNum: product.valorNum,
    categoria: product.categoria,
    subcategoria: product.subcategoria,
    variacao: product.variacao,
    descricaoIa: product.descricaoIa,
    tagsIa: product.tagsIa,
  };
}

function buildContents(history, currentMessage) {
  const contents = (Array.isArray(history) ? history : [])
    .filter((item) => item?.text)
    .map((item) => ({
      role:
        item.role === "model" || item.role === "assistant" ? "model" : "user",
      parts: [{ text: String(item.text) }],
    }));

  const last = contents.at(-1);
  if (
    !last ||
    last.role !== "user" ||
    last.parts?.[0]?.text !== currentMessage
  ) {
    contents.push({ role: "user", parts: [{ text: currentMessage }] });
  }

  return contents;
}

async function executeTool(call, context, currentMessage) {
  if (call.name === "encaminhar_humano") {
    return {
      terminalResult: {
        type: "human",
        reason: call.args?.motivo || "gemini_solicitou_humano",
      },
    };
  }

  if (call.name === "buscar_produtos") {
    const term = String(call.args?.termo || "").trim();
    if (!term) {
      return { terminalResult: { type: "human", reason: "busca_sem_termo" } };
    }

    const products = await buscarProdutos(term, { todos: true });
    logger.info("Gemini consultou catálogo", {
      termo: term,
      resultados: products.length,
    });
    return {
      functionResponse: {
        termo: term,
        total: products.length,
        produtos: products.map(productForGemini),
      },
    };
  }

  if (call.name === "preparar_pedido") {
    const result = await prepareOrder({
      phone: context.phone,
      profileName: context.profileName,
      args: call.args || {},
    });
    return {
      functionResponse: result,
      preparedOrderId: result.ok ? result.orderId : null,
    };
  }

  if (call.name === "finalizar_pedido") {
    const result = await finalizeOrder({
      orderId: call.args?.pedidoId,
      currentMessage,
    });
    return {
      functionResponse: result.ok
        ? {
            ok: true,
            pedidoId: result.order.id,
            codigo: result.order.code,
            total: result.totalFormatted,
            pagamento: result.order.paymentMethod,
            recebimento: result.order.fulfillment,
            endereco: result.order.address,
            pix: result.pix || null,
          }
        : result,
      finalizedOrder: result.ok ? result.order : null,
    };
  }

  return {
    terminalResult: {
      type: "human",
      reason: `ferramenta_desconhecida:${call.name}`,
    },
  };
}

async function responderComIA(context) {
  const currentMessage = String(context?.message || "").trim();
  if (!currentMessage) {
    return { type: "human", reason: "mensagem_vazia" };
  }

  const contents = buildContents(context.history, currentMessage);
  let preparedOrderId = null;
  let finalizedOrder = null;

  for (let round = 0; round < 6; round += 1) {
    const response = await ai.models.generateContent({
      model: config.gemini.model,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.45,
        maxOutputTokens: 900,
        tools: [{ functionDeclarations: tools }],
      },
    });

    const calls = response.functionCalls || [];
    if (!calls.length) {
      const text = response.text?.trim();
      if (!text) {
        return { type: "human", reason: "gemini_sem_resposta" };
      }
      return { type: "response", text, preparedOrderId, finalizedOrder };
    }

    if (response.candidates?.[0]?.content) {
      contents.push(response.candidates[0].content);
    }

    const functionParts = [];
    for (const call of calls) {
      const toolResult = await executeTool(call, context, currentMessage);
      if (toolResult.terminalResult) {
        return toolResult.terminalResult;
      }
      if (toolResult.preparedOrderId) {
        preparedOrderId = toolResult.preparedOrderId;
      }
      if (toolResult.finalizedOrder) {
        finalizedOrder = toolResult.finalizedOrder;
      }

      functionParts.push({
        functionResponse: {
          name: call.name,
          ...(call.id ? { id: call.id } : {}),
          response: toolResult.functionResponse,
        },
      });
    }

    contents.push({ role: "user", parts: functionParts });
  }

  return { type: "human", reason: "limite_de_rodadas" };
}

async function gerarFollowupPedido({ history, order }) {
  const recentAssistantTexts = (history || [])
    .filter((message) => ["model", "assistant"].includes(message.role))
    .map((message) => message.text)
    .filter(Boolean)
    .slice(-8);

  const prompt = `
O cliente recebeu o resumo do pedido ${order.code} há cerca de 1 hora e não respondeu.
Escreva UMA mensagem curta, educada e natural perguntando se ficou alguma dúvida ou se podemos formalizar.
Sem urgência, pressão ou menção de automação.
Evite repetir estas mensagens recentes:
${recentAssistantTexts.map((text) => `- ${text}`).join("\n") || "(nenhuma)"}
`;

  const response = await ai.models.generateContent({
    model: config.gemini.model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { temperature: 0.8, maxOutputTokens: 180 },
  });

  return (
    response.text?.trim() ||
    "Oi 😊 Ficou alguma dúvida sobre o pedido ou podemos formalizar para você?"
  );
}

module.exports = { responderComIA, gerarFollowupPedido };
