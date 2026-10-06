const config = require('../config/env');
const Logger = require('../shared/logger');

let firestoreModule = null;
function getFirestoreModule() {
  if (!firestoreModule) {
    try {
      firestoreModule = require('@google-cloud/firestore');
    } catch {
      return null;
    }
  }
  return firestoreModule;
}

class FirestoreRepository {
  constructor({ firestoreInstance = null, isInMemory = false } = {}) {
    this.firestore = firestoreInstance;
    this.inMemoryMessages = new Set();
    this.inMemorySessions = new Map();
    this.inMemoryOrders = new Map();
    this.inMemoryCustomers = new Map();

    if (!this.firestore && !isInMemory && process.env.NODE_ENV !== 'test') {
      const mod = getFirestoreModule();
      if (mod && mod.Firestore) {
        try {
          this.firestore = new mod.Firestore({
            projectId: config.gcp.projectId,
          });
        } catch (err) {
          Logger.warn('Firestore initialization failed; running with in-memory store', { error: err.message });
        }
      }
    }
  }

  async isDuplicateMessage(messageId) {
    if (!messageId) {
      return false;
    }

    if (this.firestore) {
      try {
        const doc = await this.firestore.collection('processed_messages').doc(messageId).get();
        return doc.exists;
      } catch (err) {
        Logger.warn('Erro ao verificar mensagem no Firestore; usando fallback', { error: err.message });
      }
    }

    return this.inMemoryMessages.has(messageId);
  }

  async markMessageProcessed(messageId) {
    if (!messageId) {
      return;
    }

    if (this.firestore) {
      try {
        await this.firestore.collection('processed_messages').doc(messageId).set({
          processedAt: new Date().toISOString(),
        });
        return;
      } catch (err) {
        Logger.warn('Erro ao registrar mensagem no Firestore; usando fallback', { error: err.message });
      }
    }

    this.inMemoryMessages.add(messageId);
  }

  async getSessionHistory(phone, limit = 10) {
    if (!phone) {
      return [];
    }

    if (this.firestore) {
      try {
        const snapshot = await this.firestore
          .collection('sessions')
          .doc(phone)
          .collection('messages')
          .orderBy('timestamp', 'asc')
          .limitToLast(limit)
          .get();

        return snapshot.docs.map((doc) => doc.data());
      } catch (err) {
        Logger.warn('Erro ao buscar histórico no Firestore; usando fallback', { error: err.message });
      }
    }

    const session = this.inMemorySessions.get(phone) || [];
    return session.slice(-limit);
  }

  async appendMessage(phone, role, text) {
    if (!phone || !text) {
      return;
    }

    const messageData = {
      role,
      text,
      timestamp: new Date().toISOString(),
    };

    if (this.firestore) {
      try {
        await this.firestore
          .collection('sessions')
          .doc(phone)
          .collection('messages')
          .add(messageData);
        return;
      } catch (err) {
        Logger.warn('Erro ao salvar mensagem no Firestore; usando fallback', { error: err.message });
      }
    }

    if (!this.inMemorySessions.has(phone)) {
      this.inMemorySessions.set(phone, []);
    }
    this.inMemorySessions.get(phone).push(messageData);
  }

  async saveOrder(phone, orderData) {
    const dataWithTs = {
      ...orderData,
      phone,
      updatedAt: new Date().toISOString(),
    };

    if (this.firestore) {
      try {
        await this.firestore.collection('orders').doc(phone).set(dataWithTs, { merge: true });
        return;
      } catch (err) {
        Logger.warn('Erro ao salvar pedido no Firestore; usando fallback', { error: err.message });
      }
    }

    this.inMemoryOrders.set(phone, dataWithTs);
  }

  async getOrder(phone) {
    if (!phone) return null;
    if (this.firestore) {
      try {
        const doc = await this.firestore.collection('orders').doc(phone).get();
        return doc.exists ? doc.data() : null;
      } catch (err) {
        Logger.warn('Erro ao buscar pedido no Firestore; usando fallback', { error: err.message });
      }
    }

    return this.inMemoryOrders.get(phone) || null;
  }

  async getCustomerProfile(phone) {
    if (!phone) return null;
    if (this.firestore) {
      try {
        const doc = await this.firestore.collection('customers').doc(phone).get();
        return doc.exists ? doc.data() : null;
      } catch (err) {
        Logger.warn('Erro ao buscar perfil do cliente no Firestore; usando fallback', { error: err.message });
      }
    }

    return this.inMemoryCustomers.get(phone) || null;
  }

  async saveCustomerProfile(phone, profileData) {
    if (!phone) return;
    const dataWithTs = {
      ...profileData,
      phone,
      updatedAt: new Date().toISOString(),
    };

    if (this.firestore) {
      try {
        await this.firestore.collection('customers').doc(phone).set(dataWithTs, { merge: true });
        return;
      } catch (err) {
        Logger.warn('Erro ao salvar perfil do cliente no Firestore; usando fallback', { error: err.message });
      }
    }

    const existing = this.inMemoryCustomers.get(phone) || {};
    this.inMemoryCustomers.set(phone, { ...existing, ...dataWithTs });
  }
}

module.exports = {
  FirestoreRepository,
};
