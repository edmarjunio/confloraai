const config = require('../config/env');
const Logger = require('../shared/logger');

class WhatsAppClient {
  constructor() {
    this.baseUrl = `https://graph.facebook.com/${config.whatsapp.graphVersion}/${config.whatsapp.phoneNumberId}`;
    this.token = config.whatsapp.token;
  }

  /**
   * Envia uma mensagem de texto simples.
   * @param {string} to - Número de telefone do destinatário
   * @param {string} text - Corpo da mensagem
   */
  async sendTextMessage(to, text) {
    if (!this.token || !config.whatsapp.phoneNumberId) {
      Logger.info(`[WhatsApp Mock Texto] Para: ${to} | Mensagem: ${text}`);
      return { mock: true, success: true };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
    };

    return this.postRequest('/messages', payload);
  }

  /**
   * Envia uma imagem hospedada no Google Drive ou URL pública com legenda formatada.
   * @param {string} to - Destinatário
   * @param {string} imageUrl - Link direto da imagem (Google Drive ou web)
   * @param {string} caption - Legenda com o nome do produto e valores
   */
  async sendImageMessage(to, imageUrl, caption = '') {
    if (!this.token || !config.whatsapp.phoneNumberId) {
      Logger.info(`[WhatsApp Mock Imagem] Para: ${to} | Imagem: ${imageUrl} | Legenda: ${caption}`);
      return { mock: true, success: true };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image: {
        link: imageUrl,
        caption,
      },
    };

    return this.postRequest('/messages', payload);
  }

  /**
   * Envia mensagem de modelo (template) pré-aprovado pela Meta.
   * @param {string} to
   * @param {string} templateName
   * @param {string} [languageCode='pt_BR']
   * @param {Array<Object>} [components=[]]
   */
  async sendTemplate(to, templateName, languageCode = 'pt_BR', components = []) {
    if (!this.token || !config.whatsapp.phoneNumberId) {
      Logger.info(`[WhatsApp Template Mock] Para: ${to} | Template: ${templateName}`);
      return { mock: true, success: true };
    }

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };

    return this.postRequest('/messages', payload);
  }

  /**
   * Marca a mensagem como lida.
   * @param {string} messageId
   */
  async markAsRead(messageId) {
    if (!this.token || !config.whatsapp.phoneNumberId || !messageId) {
      return { mock: true };
    }

    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    return this.postRequest('/messages', payload);
  }

  async postRequest(endpoint, body) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        Logger.error('Erro na resposta da Meta Graph API', null, { status: response.status, data });
      }
      return data;
    } catch (error) {
      Logger.error('Falha de conexão com a Meta Graph API', error);
      throw error;
    }
  }
}

module.exports = {
  WhatsAppClient,
};
