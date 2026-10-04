const crypto = require("crypto");
const { Firestore, FieldValue, Timestamp } = require("@google-cloud/firestore");
const { config } = require("../config/env");
const { onlyDigits } = require("../shared/text");

const db = new Firestore({ projectId: config.projectId });

function phoneKey(phone) {
  const normalized = onlyDigits(phone);
  if (!normalized) {
    throw new Error("Telefone inválido.");
  }
  return normalized;
}

function hashId(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function conversationRef(phone) {
  return db.collection("conversations").doc(phoneKey(phone));
}

function orderRef(orderId) {
  return db.collection("orders").doc(String(orderId));
}

async function getConversation(phone) {
  const snap = await conversationRef(phone).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function upsertConversation(phone, data = {}) {
  await conversationRef(phone).set(
    {
      phone: phoneKey(phone),
      updatedAt: FieldValue.serverTimestamp(),
      ...data,
    },
    { merge: true },
  );
}

async function setHumanMode(phone, enabled, reason = null) {
  await upsertConversation(phone, {
    mode: enabled ? "humano" : "ia",
    humanReason: enabled ? reason || "manual" : null,
    humanModeAt: enabled ? FieldValue.serverTimestamp() : null,
  });
}

async function addMessage(phone, message) {
  await conversationRef(phone)
    .collection("messages")
    .doc()
    .set({
      role: message.role,
      text: message.text || "",
      type: message.type || "text",
      messageId: message.messageId || null,
      createdAt: message.createdAt || FieldValue.serverTimestamp(),
      metadata: message.metadata || null,
    });
}

async function getRecentMessages(phone, limit = 30) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 60));
  const snap = await conversationRef(phone)
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(safeLimit)
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).reverse();
}

async function claimLease(collectionName, externalId) {
  if (!externalId) {
    return true;
  }

  const ref = db.collection(collectionName).doc(hashId(externalId));
  const now = Date.now();
  const leaseUntil = Timestamp.fromMillis(now + 5 * 60 * 1000);

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);

    if (snap.exists) {
      const data = snap.data() || {};
      if (data.completedAt || data.forwardedAt) {
        return false;
      }
      if (toMillis(data.leaseUntil) > now) {
        return false;
      }

      transaction.set(
        ref,
        {
          originalId: externalId,
          leaseUntil,
          lastAttemptAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return true;
    }

    transaction.create(ref, {
      originalId: externalId,
      leaseUntil,
      startedAt: FieldValue.serverTimestamp(),
      lastAttemptAt: FieldValue.serverTimestamp(),
      completedAt: null,
      forwardedAt: null,
    });
    return true;
  });
}

async function claimMessage(messageId) {
  return claimLease("processed_messages", messageId);
}

async function completeMessage(messageId) {
  if (!messageId) {
    return;
  }
  await db.collection("processed_messages").doc(hashId(messageId)).set(
    {
      completedAt: FieldValue.serverTimestamp(),
      leaseUntil: null,
      lastError: null,
    },
    { merge: true },
  );
}

async function releaseMessage(messageId, error) {
  if (!messageId) {
    return;
  }
  await db
    .collection("processed_messages")
    .doc(hashId(messageId))
    .set(
      {
        leaseUntil: null,
        lastError: String(error?.message || error || "erro"),
      },
      { merge: true },
    );
}

async function createOrder(data) {
  const ref = db.collection("orders").doc();
  await ref.set({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function getOrder(orderId) {
  if (!orderId) {
    return null;
  }
  const snap = await orderRef(orderId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function updateOrder(orderId, data) {
  await orderRef(orderId).set(
    {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function getActiveOrder(phone) {
  const conversation = await getConversation(phone);
  return conversation?.activeOrderId
    ? getOrder(conversation.activeOrderId)
    : null;
}

async function setActiveOrder(phone, orderId) {
  await upsertConversation(phone, { activeOrderId: orderId || null });
}

async function markCustomerActivity(phone, profileName = null) {
  const data = { lastCustomerMessageAt: FieldValue.serverTimestamp() };
  if (profileName) {
    data.profileName = profileName;
  }
  await upsertConversation(phone, data);
}

async function markAssistantActivity(phone) {
  await upsertConversation(phone, {
    lastAssistantMessageAt: FieldValue.serverTimestamp(),
  });
}

async function claimReceiptForward(messageId) {
  return claimLease("forwarded_receipts", messageId);
}

async function markReceiptForwarded(messageId, data = {}) {
  await db
    .collection("forwarded_receipts")
    .doc(hashId(messageId))
    .set(
      {
        forwardedAt: FieldValue.serverTimestamp(),
        leaseUntil: null,
        lastError: null,
        ...data,
      },
      { merge: true },
    );
}

async function releaseReceiptForward(messageId, error) {
  await db
    .collection("forwarded_receipts")
    .doc(hashId(messageId))
    .set(
      {
        leaseUntil: null,
        lastError: String(error?.message || error || "erro"),
      },
      { merge: true },
    );
}

function toMillis(value) {
  if (!value) {
    return 0;
  }
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

module.exports = {
  FieldValue,
  getConversation,
  upsertConversation,
  setHumanMode,
  addMessage,
  getRecentMessages,
  claimMessage,
  completeMessage,
  releaseMessage,
  createOrder,
  getOrder,
  updateOrder,
  getActiveOrder,
  setActiveOrder,
  markCustomerActivity,
  markAssistantActivity,
  claimReceiptForward,
  markReceiptForwarded,
  releaseReceiptForward,
  toMillis,
};
