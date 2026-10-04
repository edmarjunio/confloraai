const crypto = require("crypto");
const {
  FieldValue,
  getConversation,
  getOrder,
  createOrder,
  updateOrder,
  setActiveOrder,
  upsertConversation,
} = require("../database/firestore.repository");
const { obterProdutosPorIds } = require("../catalog/catalog.repository");
const { config } = require("../config/env");
const { normalizeText, formatBRL } = require("../shared/text");
const { isExplicitConfirmation } = require("./confirmation");

function normalizePayment(value) {
  const text = normalizeText(value);
  if (text.includes("pix")) {
    return "pix";
  }
  if (text.includes("dinheiro")) {
    return "dinheiro";
  }
  if (
    text.includes("cartao") ||
    text.includes("credito") ||
    text.includes("debito")
  ) {
    return "cartao";
  }
  return text || "outro";
}

function normalizeFulfillment(value) {
  const text = normalizeText(value);
  if (text.includes("entrega") || text.includes("entregar")) {
    return "entrega";
  }
  if (
    text.includes("retirada") ||
    text.includes("retirar") ||
    text.includes("buscar")
  ) {
    return "retirada";
  }
  return null;
}

function generateOrderCode() {
  const date = new Date();
  const ymd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `CF-${ymd}-${suffix}`;
}

async function buildCanonicalItems(items, options = {}) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error("Pedido sem itens.");
  }

  const quantitiesByProduct = new Map();
  for (const item of items) {
    const productId = String(item.productId || "").trim();
    const quantity = Math.max(1, Math.floor(Number(item.quantidade || 1)));
    if (!productId) {
      throw new Error("Item sem Product ID.");
    }
    quantitiesByProduct.set(
      productId,
      (quantitiesByProduct.get(productId) || 0) + quantity,
    );
  }

  const productsById = await obterProdutosPorIds(
    [...quantitiesByProduct.keys()],
    { forceRefresh: options.forceRefresh === true },
  );

  const canonicalItems = [];
  for (const [productId, quantity] of quantitiesByProduct.entries()) {
    const product = productsById.get(productId);
    if (!product) {
      throw new Error(`Produto não encontrado ou não exibível: ${productId}`);
    }
    if (!Number.isFinite(Number(product.valorNum))) {
      throw new Error(
        `Produto sem preço numérico válido: ${product.descricao}`,
      );
    }

    const unitPrice = Number(product.valorNum);
    canonicalItems.push({
      productId: product.id,
      description: product.descricao,
      variation: product.variacao || "",
      quantity,
      unitPrice,
      subtotal: Number((unitPrice * quantity).toFixed(2)),
    });
  }

  return canonicalItems;
}

async function prepareOrder({ phone, profileName, args }) {
  const customerName = String(args.cliente_nome || profileName || "").trim();
  if (!customerName) {
    return { ok: false, reason: "nome_cliente_ausente" };
  }

  const fulfillment = normalizeFulfillment(args.recebimento);
  if (!fulfillment) {
    return { ok: false, reason: "recebimento_ausente" };
  }

  const address = String(args.endereco || "").trim();
  if (fulfillment === "entrega" && address.length < 8) {
    return { ok: false, reason: "endereco_entrega_incompleto" };
  }

  const paymentMethod = normalizePayment(args.forma_pagamento);
  const items = await buildCanonicalItems(args.itens);
  const total = Number(
    items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2),
  );

  const conversation = await getConversation(phone);
  let orderId = conversation?.activeOrderId || null;
  const existingOrder = orderId ? await getOrder(orderId) : null;

  const orderData = {
    customerName,
    items,
    fulfillment,
    address: fulfillment === "entrega" ? address : null,
    paymentMethod,
    total,
    status: "montando",
    observations: String(args.observacoes || "").trim() || null,
  };

  if (
    !existingOrder ||
    !["montando", "aguardando_confirmacao"].includes(existingOrder.status)
  ) {
    orderId = await createOrder({
      code: generateOrderCode(),
      phone,
      ...orderData,
      followupToken: null,
      confirmationRequestedAt: null,
      confirmedAt: null,
      ownerNotificationSentAt: null,
    });
  } else {
    await updateOrder(orderId, orderData);
  }

  await setActiveOrder(phone, orderId);
  await upsertConversation(phone, { customerName });

  const order = await getOrder(orderId);
  return {
    ok: true,
    orderId,
    code: order.code,
    customerName,
    items,
    fulfillment,
    address: fulfillment === "entrega" ? address : null,
    paymentMethod,
    total,
    totalFormatted: formatBRL(total),
  };
}

async function markSummarySent(orderId) {
  const followupToken = crypto.randomBytes(16).toString("hex");
  await updateOrder(orderId, {
    status: "aguardando_confirmacao",
    followupToken,
    confirmationRequestedAt: FieldValue.serverTimestamp(),
    followupSentAt: null,
  });
  return followupToken;
}

async function finalizeOrder({ orderId, currentMessage }) {
  const order = await getOrder(orderId);
  if (!order) {
    return { ok: false, reason: "pedido_nao_encontrado" };
  }
  if (order.status === "confirmado") {
    return { ok: true, alreadyFinalized: true, order };
  }
  if (order.status !== "aguardando_confirmacao") {
    return { ok: false, reason: "pedido_nao_aguarda_confirmacao" };
  }
  if (!isExplicitConfirmation(currentMessage)) {
    return { ok: false, reason: "confirmacao_nao_inequivoca" };
  }

  const canonicalItems = await buildCanonicalItems(
    (order.items || []).map((item) => ({
      productId: item.productId,
      quantidade: item.quantity,
    })),
    { forceRefresh: true },
  );
  const total = Number(
    canonicalItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2),
  );

  await updateOrder(orderId, {
    items: canonicalItems,
    total,
    status: "confirmado",
    confirmedAt: FieldValue.serverTimestamp(),
    finalCustomerMessage: currentMessage,
    followupToken: null,
  });

  const updatedOrder = await getOrder(orderId);
  const result = {
    ok: true,
    order: updatedOrder,
    totalFormatted: formatBRL(total),
  };

  if (updatedOrder.paymentMethod === "pix") {
    if (!config.pix.key || !config.pix.holder) {
      throw new Error("PIX_KEY e PIX_TITULAR precisam estar configurados.");
    }
    result.pix = { key: config.pix.key, holder: config.pix.holder };
  }

  return result;
}

module.exports = {
  prepareOrder,
  markSummarySent,
  finalizeOrder,
};
