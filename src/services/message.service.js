const {
  FieldValue,
  getConversation,
  addMessage,
  getRecentMessages,
  claimMessage,
  completeMessage,
  releaseMessage,
  markCustomerActivity,
  markAssistantActivity,
  setHumanMode,
  getOrder,
  updateOrder,
  getActiveOrder,
  claimReceiptForward,
  markReceiptForwarded,
  releaseReceiptForward,
  toMillis,
} = require("../database/firestore.repository");
const { responderComIA, gerarFollowupPedido } = require("../ai/agent.service");
const { markSummarySent } = require("../orders/order.service");
const {
  scheduleOrderFollowup,
  scheduleOwnerOrderNotification,
  scheduleReceiptForward,
} = require("../integrations/task-queue.client");
const {
  sendText,
  notifyOwnerOrder,
  forwardReceiptToOwner,
} = require("../integrations/whatsapp.client");
const { config } = require("../config/env");
const { formatBRL } = require("../shared/text");
const logger = require("../shared/logger");

function appendPixInstructions(text, order) {
  if (!order || order.paymentMethod !== "pix") {
    return text;
  }
  if (!config.pix.key || !config.pix.holder) {
    return text;
  }
  if (String(text).includes(config.pix.key)) {
    return text;
  }

  return `${text}\n\n💳 *PIX*\nChave: ${config.pix.key}\nTitular: ${config.pix.holder}\nValor: ${formatBRL(order.total)}\n\nQuando fizer o pagamento, envie o comprovante por foto ou PDF por aqui.`;
}

async function processTextMessage({
  phone,
  profileName,
  message,
  messageId = null,
  sendToWhatsApp = false,
}) {
  let claimed = false;

  try {
    if (messageId) {
      claimed = await claimMessage(messageId);
      if (!claimed) {
        return { action: "ignored", reason: "duplicate_or_processing_message" };
      }
    }

    await markCustomerActivity(phone, profileName);
    await addMessage(phone, {
      role: "user",
      text: message,
      type: "text",
      messageId,
    });

    const conversation = await getConversation(phone);
    if (conversation?.mode === "humano") {
      if (messageId) {
        await completeMessage(messageId);
      }
      return { action: "human", response: null, reason: "human_mode_active" };
    }

    const history = await getRecentMessages(phone, 30);
    let result;

    try {
      result = await responderComIA({ message, phone, profileName, history });
    } catch (error) {
      logger.error("Falha ao consultar Gemini", {
        error: String(error?.message || error),
        phone,
      });
      if (messageId) {
        await completeMessage(messageId);
      }
      return { action: "human", response: null, reason: "gemini_indisponivel" };
    }

    if (result.type === "human") {
      await setHumanMode(phone, true, result.reason);
      if (messageId) {
        await completeMessage(messageId);
      }
      return { action: "human", response: null, reason: result.reason };
    }

    let responseText = result.text;

    if (result.finalizedOrder?.id) {
      const freshOrder = await getOrder(result.finalizedOrder.id);
      responseText = appendPixInstructions(responseText, freshOrder);
      try {
        await scheduleOwnerOrderNotification(freshOrder.id);
      } catch (error) {
        logger.error("Falha ao agendar notificação da venda", {
          orderId: freshOrder.id,
          error: String(error?.message || error),
        });
        await updateOrder(freshOrder.id, {
          ownerNotificationPending: true,
          ownerNotificationLastError: String(error?.message || error),
        });
      }
    }

    await addMessage(phone, {
      role: "model",
      text: responseText,
      type: "text",
    });

    if (sendToWhatsApp) {
      await sendText(phone, responseText);
    }
    await markAssistantActivity(phone);

    if (result.preparedOrderId) {
      const followupToken = await markSummarySent(result.preparedOrderId);
      if (sendToWhatsApp) {
        try {
          await scheduleOrderFollowup(result.preparedOrderId, followupToken);
        } catch (error) {
          logger.error("Falha ao agendar follow-up", {
            orderId: result.preparedOrderId,
            error: String(error?.message || error),
          });
          await updateOrder(result.preparedOrderId, {
            followupSchedulePending: true,
            followupScheduleLastError: String(error?.message || error),
          });
        }
      }
    }

    if (messageId) {
      await completeMessage(messageId);
    }

    return {
      action: "respond",
      response: responseText,
      origin: "ia",
      preparedOrderId: result.preparedOrderId || null,
      finalizedOrderId: result.finalizedOrder?.id || null,
    };
  } catch (error) {
    if (messageId && claimed) {
      try {
        await releaseMessage(messageId, error);
      } catch {
        // O erro original é mais relevante.
      }
    }
    throw error;
  }
}

async function processMediaMessage({
  phone,
  profileName,
  messageId,
  mediaType,
  mediaId,
  mimeType,
  filename,
}) {
  let claimed = false;

  try {
    claimed = await claimMessage(messageId);
    if (!claimed) {
      return { action: "ignored", reason: "duplicate_or_processing_message" };
    }

    await markCustomerActivity(phone, profileName);
    const label =
      mediaType === "image"
        ? "[Imagem recebida]"
        : `[Documento recebido: ${filename || "arquivo"}]`;

    await addMessage(phone, {
      role: "user",
      text: label,
      type: mediaType,
      messageId,
      metadata: { mediaId, mimeType, filename: filename || null },
    });

    const order = await getActiveOrder(phone);
    const validReceipt =
      order?.status === "confirmado" &&
      order.paymentMethod === "pix" &&
      (mediaType === "image" ||
        (mediaType === "document" &&
          String(mimeType || "").toLowerCase() === "application/pdf"));

    if (!validReceipt) {
      await setHumanMode(phone, true, "midia_sem_pedido_pix_confirmado");
      await completeMessage(messageId);
      return {
        action: "human",
        response: null,
        reason: "midia_sem_pedido_pix_confirmado",
      };
    }

    await scheduleReceiptForward({
      orderId: order.id,
      messageId,
      mediaType,
      mediaId,
      mimeType,
      filename: filename || null,
    });

    const acknowledgement =
      "Recebi seu comprovante 😊 Vou deixar ele anexado ao seu pedido.";
    await addMessage(phone, {
      role: "model",
      text: acknowledgement,
      type: "text",
    });
    await sendText(phone, acknowledgement);
    await markAssistantActivity(phone);
    await completeMessage(messageId);

    return {
      action: "respond",
      response: acknowledgement,
      receiptForwardScheduled: true,
    };
  } catch (error) {
    if (messageId && claimed) {
      try {
        await releaseMessage(messageId, error);
      } catch {
        // O erro original é mais relevante.
      }
    }
    throw error;
  }
}

async function processInboundMessage(payload) {
  if (payload.kind === "text") {
    return processTextMessage({
      phone: payload.phone,
      profileName: payload.profileName,
      message: payload.message,
      messageId: payload.messageId,
      sendToWhatsApp: true,
    });
  }

  if (payload.kind === "media") {
    return processMediaMessage({
      phone: payload.phone,
      profileName: payload.profileName,
      messageId: payload.messageId,
      mediaType: payload.mediaType,
      mediaId: payload.mediaId,
      mimeType: payload.mimeType,
      filename: payload.filename,
    });
  }

  return { action: "ignored", reason: "unsupported_inbound_kind" };
}

async function runOrderFollowup({ orderId, followupToken }) {
  const order = await getOrder(orderId);
  if (!order) {
    return { skipped: true, reason: "order_not_found" };
  }
  if (order.status !== "aguardando_confirmacao") {
    return { skipped: true, reason: `status_${order.status}` };
  }
  if (!followupToken || order.followupToken !== followupToken) {
    return { skipped: true, reason: "stale_followup" };
  }
  if (order.followupSentAt) {
    return { skipped: true, reason: "already_sent" };
  }

  const conversation = await getConversation(order.phone);
  if (!conversation || conversation.mode === "humano") {
    return { skipped: true, reason: "human_mode_or_no_conversation" };
  }

  const requestedAt = toMillis(order.confirmationRequestedAt);
  const lastCustomerAt = toMillis(conversation.lastCustomerMessageAt);
  if (lastCustomerAt > requestedAt) {
    return { skipped: true, reason: "customer_replied" };
  }

  const history = await getRecentMessages(order.phone, 30);
  const text = await gerarFollowupPedido({ history, order });

  await sendText(order.phone, text);
  await addMessage(order.phone, { role: "model", text, type: "text" });
  await markAssistantActivity(order.phone);
  await updateOrder(orderId, { followupSentAt: FieldValue.serverTimestamp() });

  return { sent: true };
}

async function runOwnerOrderNotification({ orderId }) {
  const order = await getOrder(orderId);
  if (!order) {
    return { skipped: true, reason: "order_not_found" };
  }
  if (order.status !== "confirmado") {
    return { skipped: true, reason: `status_${order.status}` };
  }
  if (order.ownerNotificationSentAt) {
    return { skipped: true, reason: "already_sent" };
  }

  await notifyOwnerOrder(order);
  await updateOrder(orderId, {
    ownerNotificationSentAt: FieldValue.serverTimestamp(),
    ownerNotificationPending: false,
    ownerNotificationLastError: null,
  });
  return { sent: true };
}

async function runReceiptForward(payload) {
  const order = await getOrder(payload.orderId);
  if (!order) {
    return { skipped: true, reason: "order_not_found" };
  }
  if (order.status !== "confirmado" || order.paymentMethod !== "pix") {
    return { skipped: true, reason: "not_confirmed_pix_order" };
  }

  const claimed = await claimReceiptForward(payload.messageId);
  if (!claimed) {
    return { skipped: true, reason: "already_forwarded_or_claimed" };
  }

  try {
    await forwardReceiptToOwner({
      mediaType: payload.mediaType,
      mediaId: payload.mediaId,
      mimeType: payload.mimeType,
      filename: payload.filename,
      order,
    });

    await markReceiptForwarded(payload.messageId, {
      orderId: order.id,
      code: order.code,
    });
    await updateOrder(order.id, {
      receiptReceivedAt: FieldValue.serverTimestamp(),
      receiptMessageId: payload.messageId,
    });
    return { sent: true };
  } catch (error) {
    await releaseReceiptForward(payload.messageId, error);
    throw error;
  }
}

module.exports = {
  processTextMessage,
  processInboundMessage,
  runOrderFollowup,
  runOwnerOrderNotification,
  runReceiptForward,
};
