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
   * Envia uma imagem pública, como uma foto hospedada no Firebase Storage, com legenda formatada.
   * @param {string} to - Destinatário
   * @param {string} imageUrl - URL pública da imagem do produto
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

  async sendImageBuffer(to, buffer, caption = '') {
    if (!this.token || !config.whatsapp.phoneNumberId) { throw new Error('WhatsApp não configurado.'); }
    const form = new FormData();
    form.set('messaging_product', 'whatsapp');
    form.set('file', new Blob([buffer], { type: 'image/png' }), 'pix.png');
    const response = await fetch(`${this.baseUrl}/media`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.token}` }, body: form, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) { throw new Error(`Falha ao enviar QR Code ao WhatsApp (HTTP ${response.status}).`); }
    const media = await response.json();
    if (!media.id) { throw new Error('WhatsApp não retornou a imagem.'); }
    if (process.env.WHATSAPP_PDV_QR_TEMPLATE) {
      return this.sendTemplate(to, process.env.WHATSAPP_PDV_QR_TEMPLATE, config.whatsapp.templates.language || 'pt_BR', [
        { type: 'header', parameters: [{ type: 'image', image: { id: media.id } }] },
        { type: 'body', parameters: [{ type: 'text', text: caption }] },
      ]);
    }
    return this.postRequest('/messages', { messaging_product: 'whatsapp', to, type: 'image', image: { id: media.id, caption } });
  }

  async sendDocumentBuffer(to, buffer, filename, caption = '') {
    if (!this.token || !config.whatsapp.phoneNumberId) throw new Error('WhatsApp não configurado. Baixe o PDF e configure a integração para enviar.');
    const form = new FormData();
    form.set('messaging_product', 'whatsapp');
    form.set('file', new Blob([buffer], { type: 'application/pdf' }), filename);
    const response = await fetch(this.baseUrl + '/media', {
      method: 'POST', headers: { Authorization: 'Bearer ' + this.token }, body: form, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Não foi possível anexar o PDF ao WhatsApp (HTTP ' + response.status + ').');
    const media = await response.json();
    if (!media.id) throw new Error('O WhatsApp não retornou o documento.');
    const template = process.env.WHATSAPP_CASHIER_REPORT_TEMPLATE;
    if (template) return this.sendTemplate(to, template, config.whatsapp.templates.language || 'pt_BR', [
      { type: 'header', parameters: [{ type: 'document', document: { id: media.id, filename } }] },
      { type: 'body', parameters: [{ type: 'text', text: caption }] },
    ]);
    return this.postRequest('/messages', { messaging_product: 'whatsapp', to, type: 'document', document: { id: media.id, filename, caption } });
  }

  async sendPdvText(to, text) {
    const template = process.env.WHATSAPP_PDV_TEXT_TEMPLATE || config.whatsapp.templates.customerOrder;
    if (!template) { return this.sendTextMessage(to, text); }
    return this.sendTemplate(to, template, config.whatsapp.templates.language || 'pt_BR', [
      { type: 'body', parameters: [{ type: 'text', text: text.replace(/\s+/g, ' ').trim() }] },
    ]);
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
   * Apenas executa para IDs oficiais da Meta (wamid.), prevenindo erro #131009 em testes locais.
   * @param {string} messageId
   */
  async markAsRead(messageId) {
    if (!this.token || !config.whatsapp.phoneNumberId || !messageId) {
      return { mock: true };
    }

    // Proteção contra erro 131009 da Meta Graph API para IDs de teste local (ex: local-...)
    if (typeof messageId !== 'string' || !messageId.startsWith('wamid.')) {
      return { mock: true, skippedNonMetaId: true };
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
        signal: AbortSignal.timeout(15000),
      });

      const data = await response.json();
      if (!response.ok) {
        const code = Number(data?.error?.code) || null;
        const authenticationFailed = response.status === 401 || code === 190;
        const message = authenticationFailed
          ? 'WhatsApp: token recusado pela Meta. Atualize WHATSAPP_TOKEN com um token válido e reinicie o servidor.'
          : `WhatsApp: solicitação recusada pela Meta (HTTP ${response.status}${code ? `, código ${code}` : ''}).`;
        const error = Object.assign(new Error(message), { status: response.status, code });
        Logger.error(message, null, { status: response.status, code });
        throw error;
      }
      return data;
    } catch (error) {
      if (!error.status) Logger.error('Falha de conexão com a Meta Graph API', error);
      throw error;
    }
  }
}

module.exports = {
  WhatsAppClient,
};
