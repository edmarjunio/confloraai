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
    if (!this.token || !config.whatsapp.phoneNumberId) { throw Object.assign(new Error('WhatsApp não configurado.'), { definitelyNotSent: true }); }
    const form = new FormData();
    form.set('messaging_product', 'whatsapp');
    form.set('file', new Blob([buffer], { type: 'image/png' }), 'pix.png');
    const media = await this.uploadMedia(form);
    if (process.env.WHATSAPP_PDV_QR_TEMPLATE) {
      return this.sendTemplate(to, process.env.WHATSAPP_PDV_QR_TEMPLATE, config.whatsapp.templates.language || 'pt_BR', [
        { type: 'header', parameters: [{ type: 'image', image: { id: media.id } }] },
        { type: 'body', parameters: [{ type: 'text', text: caption }] },
      ]);
    }
    return this.postRequest('/messages', { messaging_product: 'whatsapp', to, type: 'image', image: { id: media.id, caption } });
  }

  async sendDocumentBuffer(to, buffer, filename, caption = '') {
    if (!this.token || !config.whatsapp.phoneNumberId) throw Object.assign(new Error('WhatsApp não configurado. Baixe o PDF e configure a integração para enviar.'), { definitelyNotSent: true });
    const form = new FormData();
    form.set('messaging_product', 'whatsapp');
    form.set('file', new Blob([buffer], { type: 'application/pdf' }), filename);
    const media = await this.uploadMedia(form);
    const template = process.env.WHATSAPP_CASHIER_REPORT_TEMPLATE;
    if (template) return this.sendTemplate(to, template, config.whatsapp.templates.language || 'pt_BR', [
      { type: 'header', parameters: [{ type: 'document', document: { id: media.id, filename } }] },
      { type: 'body', parameters: [{ type: 'text', text: caption }] },
    ]);
    return this.postRequest('/messages', { messaging_product: 'whatsapp', to, type: 'document', document: { id: media.id, filename, caption } });
  }

  async uploadMedia(form) {
    try {
      const response = await fetch(this.baseUrl + '/media', {
        method: 'POST', headers: { Authorization: 'Bearer ' + this.token }, body: form, signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Falha ao anexar mídia ao WhatsApp (HTTP ' + response.status + ').');
      const media = await response.json();
      if (!media.id) throw new Error('O WhatsApp não retornou a mídia.');
      return media;
    } catch (error) {
      // Media upload cannot deliver a customer message; retrying it is safe.
      error.definitelyNotSent = true;
      throw error;
    }
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
   * Envia o modelo de boas-vindas com os botões diretos de Montar Sacola, Catálogo e Atendente.
   * @param {string} to
   * @param {string} [customerName='']
   */
  async sendWelcomeTemplate(to, customerName = '') {
    const { welcomeContract, welcomeComponents } = require('./whatsapp-welcome');
    const contract = welcomeContract();
    const fs = require('node:fs/promises');
    const path = require('node:path');
    const logoBuffer = await fs.readFile(path.resolve(__dirname, '../../public/storefront/brands/conflora-logo.png'));
    const form = new FormData();
    form.set('messaging_product', 'whatsapp');
    form.set('file', new Blob([logoBuffer], { type: 'image/png' }), 'conflora-logo.png');
    const headerImage = await this.uploadMedia(form);
    return this.sendTemplate(to, contract.name, contract.language, welcomeComponents(contract, customerName, { id: headerImage.id }));
  }

  async sendCatalogMessage(to) {
    if (process.env.WHATSAPP_META_CATALOG_ENABLED !== 'true' || !process.env.WHATSAPP_META_CATALOG_ID) throw Object.assign(new Error('Catálogo Meta ainda não habilitado e vinculado.'), { definitelyNotSent: true });
    return this.postRequest('/messages', { messaging_product: 'whatsapp', recipient_type: 'individual', to,
      type: 'interactive', interactive: { type: 'catalog_message', body: { text: 'Escolha os produtos e envie seu carrinho. Valores e disponibilidade serão conferidos antes da confirmação.' }, action: { name: 'catalog_message' } } });
  }

  /**
   * Envia uma mensagem interativa de lista (opções nativas no WhatsApp)
   */
  async sendInteractiveList(to, { headerText = '', bodyText, footerText = '', buttonText = 'Ver opções', sections }) {


    const interactive = {
      type: 'list',
      action: {
        button: String(buttonText).slice(0, 20),
        sections,
      },
      body: {
        text: String(bodyText).slice(0, 1024),
      },
    };

    if (headerText) {
      interactive.header = {
        type: 'text',
        text: String(headerText).slice(0, 60),
      };
    }
    if (footerText) {
      interactive.footer = {
        text: String(footerText).slice(0, 60),
      };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    };

    return this.postRequest('/messages', payload);
  }

  /**
   * Envia botões interativos rápidos nativos no WhatsApp (até 3 botões)
   */
  async sendInteractiveButtons(to, { bodyText, buttons, headerText = '', footerText = '' }) {


    const interactive = {
      type: 'button',
      body: {
        text: String(bodyText).slice(0, 1024),
      },
      action: {
        buttons: buttons.slice(0, 3).map((btn) => ({
          type: 'reply',
          reply: {
            id: String(btn.id).slice(0, 256),
            title: String(btn.title).slice(0, 20),
          },
        })),
      },
    };

    if (headerText) {
      interactive.header = {
        type: 'text',
        text: String(headerText).slice(0, 60),
      };
    }
    if (footerText) {
      interactive.footer = {
        text: String(footerText).slice(0, 60),
      };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
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
      return { skipped: true, reason: 'not_configured_or_missing_id' };
    }

    // Proteção contra erro 131009 da Meta Graph API para IDs de teste local (ex: local-...)
    if (typeof messageId !== 'string' || !messageId.startsWith('wamid.')) {
      return { skipped: true, reason: 'invalid_message_id' };
    }

    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    return this.postRequest('/messages', payload);
  }

  formatRecipient(to) {
    if (!to) return to;
    const digits = String(to).replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length === 12) {
      const ddd = Number(digits.slice(2, 4));
      if (ddd >= 11 && ddd <= 99) {
        return '55' + digits.slice(2, 4) + '9' + digits.slice(4);
      }
    }
    return digits;
  }

  async postRequest(endpoint, body) {
    if (body?.to) await require('../services/automation-send-guard').beforeSubmission();
    if (!this.token || !config.whatsapp.phoneNumberId) {
      throw Object.assign(new Error('WhatsApp não configurado.'), { status: 503, definitelyNotSent: true });
    }
    if (body?.to) {
      body.to = this.formatRecipient(body.to);
    }
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
        const error = Object.assign(new Error(message), { status: response.status, code,
          definitelyNotSent: response.status >= 400 && response.status < 500 });
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
