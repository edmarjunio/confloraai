const https = require('node:https');
const crypto = require('node:crypto');
const QRCode = require('qrcode');
const { generatePixCode } = require('../orders/pix.util');
const Logger = require('../shared/logger');

class SicrediPixClient {
  /**
   * @param {Object} [config]
   * @param {string} [config.baseUrl]
   * @param {string} [config.authUrl]
   * @param {string} [config.clientId]
   * @param {string} [config.clientSecret]
   * @param {string} [config.certificate] - PEM certificate
   * @param {string} [config.privateKey] - PEM private key
   * @param {string} [config.pixKey] - Chave Pix (CPF ou CNPJ)
   * @param {string} [config.beneficiario] - Nome do titular da conta Sicredi
   * @param {string} [config.cidade] - Cidade da conta Sicredi
   */
  constructor({
    baseUrl = process.env.SICREDI_PIX_BASE_URL || 'https://api-pix.sicredi.com.br',
    authUrl = process.env.SICREDI_OAUTH_URL || 'https://api-pix.sicredi.com.br/oauth/token',
    clientId = process.env.SICREDI_CLIENT_ID || '',
    clientSecret = process.env.SICREDI_CLIENT_SECRET || '',
    certificate = process.env.SICREDI_CERT_PEM || '',
    privateKey = process.env.SICREDI_KEY_PEM || '',
    pixKey = process.env.SICREDI_PIX_KEY || process.env.PIX_KEY || '64999351616',
    beneficiario = process.env.SICREDI_BENEFICIARIO || process.env.PIX_TITULAR || 'Conflora Horta e Viveiro',
    cidade = process.env.SICREDI_CIDADE || 'Mineiros',
    webhookSecret = process.env.SICREDI_WEBHOOK_SECRET || '',
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.authUrl = authUrl;
    this.clientId = clientId.trim();
    this.clientSecret = clientSecret.trim();
    this.certificate = certificate;
    this.privateKey = privateKey;
    this.pixKey = (pixKey || '64999351616').trim();
    this.beneficiario = (beneficiario || 'Conflora Horta e Viveiro').trim();
    this.cidade = (cidade || 'Mineiros').trim();
    this.webhookSecret = webhookSecret.trim();

    this.tokenCache = null;
    this.tokenExpiresAt = 0;

    // Cache local de cobranças para consulta rápida
    this.localCharges = new Map();
  }

  /**
   * Verifica se as credenciais completas da API do Sicredi (OAuth + Certificado) estão ativas.
   */
  get isOfficialApiConfigured() {
    return Boolean(
      this.clientId &&
      this.clientSecret &&
      (this.certificate || process.env.NODE_ENV !== 'production')
    );
  }

  /**
   * Cria o agente HTTPS com mTLS para o Sicredi caso certificados sejam fornecidos.
   */
  getHttpsAgent() {
    if (this.certificate && this.privateKey) {
      return new https.Agent({
        cert: this.certificate,
        key: this.privateKey,
        rejectUnauthorized: true,
      });
    }
    return undefined;
  }

  /**
   * Gera um txid válido para o padrão Pix do Banco Central (alfanumérico, 26 a 35 caracteres).
   * @param {string} [prefix='conflora']
   * @returns {string}
   */
  generateTxId(prefix = 'cfl') {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    const txid = `${prefix}${timestamp}${random}`.replace(/[^a-zA-Z0-9]/g, '');
    return txid.slice(0, 32).padEnd(26, '0');
  }

  /**
   * Obtém token OAuth2 da API Pix do Sicredi com mTLS.
   */
  async getAccessToken() {
    if (this.tokenCache && Date.now() < this.tokenExpiresAt) {
      return this.tokenCache;
    }

    if (!this.isOfficialApiConfigured) {
      return null;
    }

    try {
      const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'cob.write cob.read webhook.write webhook.read',
      });

      const response = await fetch(this.authUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        // @ts-ignore
        agent: this.getHttpsAgent(),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha na autenticação Sicredi Pix (HTTP ${response.status}): ${errorText}`);
      }

      const data = await response.json();
      this.tokenCache = data.access_token;
      this.tokenExpiresAt = Date.now() + (Number(data.expires_in || 3600) - 60) * 1000;
      return this.tokenCache;
    } catch (err) {
      Logger.warn('[Sicredi Pix] Falha ao obter token OAuth2 da API Sicredi, utilizando modo padrão EMV', {
        error: err.message,
      });
      return null;
    }
  }

  /**
   * Cria uma cobrança Pix no Sicredi com valor exato travado (modalidadeAlteracao: 0)
   * e gera o QR Code na tela. Se a API Sicredi estiver indisponível ou for conta PF (CPF),
   * usa o gerador nativo padrão EMV Banco Central de alta fidelidade.
   * 
   * @param {Object} params
   * @param {number} params.amount - Valor da venda
   * @param {string} [params.txid] - Identificador único da transação
   * @param {string} [params.customerName] - Nome do cliente
   * @param {string} [params.customerCpfCnpj] - CPF ou CNPJ do cliente (opcional)
   * @param {string} [params.ticketNumber] - Número da comanda / ficha
   * @param {string} [params.description] - Descrição no extrato Pix
   * @returns {Promise<{
   *   txid: string,
   *   pixCopiaECola: string,
   *   qrCodeBase64: string,
   *   amount: number,
   *   pixKey: string,
   *   beneficiario: string,
   *   status: string,
   *   provider: string,
   *   mode: 'API_SICREDI' | 'EMV_SICREDI_STATIC'
   * }>}
   */
  async createCharge({
    amount,
    txid = null,
    customerName = 'Cliente',
    customerCpfCnpj = '',
    ticketNumber = '',
    description = '',
  }) {
    const val = Number(amount);
    if (!Number.isFinite(val) || val <= 0) {
      throw new Error('Valor inválido para cobrança Pix Sicredi.');
    }

    const cleanAmountStr = val.toFixed(2);
    const finalTxid = txid || this.generateTxId();
    const token = await this.getAccessToken();

    let pixCopiaECola = '';
    let usedMode = 'EMV_SICREDI_STATIC';

    // Tentativa na API Oficial do Sicredi (PUT /cob/{txid})
    if (token) {
      try {
        const payload = {
          calendario: { expiracao: 3600 },
          valor: {
            original: cleanAmountStr,
            modalidadeAlteracao: 0, // Trava o valor para impedir alteração pelo cliente
          },
          chave: this.pixKey,
          solicitacaoPagador: description || `Pedido Conflora #${ticketNumber || finalTxid.slice(-6)}`,
        };

        const cleanDoc = String(customerCpfCnpj || '').replace(/\D/g, '');
        if (cleanDoc.length === 11) {
          payload.devedor = { cpf: cleanDoc, nome: customerName || 'Cliente' };
        } else if (cleanDoc.length === 14) {
          payload.devedor = { cnpj: cleanDoc, nome: customerName || 'Cliente' };
        }

        const putUrl = `${this.baseUrl}/cob/${encodeURIComponent(finalTxid)}`;
        const res = await fetch(putUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          // @ts-ignore
          agent: this.getHttpsAgent(),
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const cobData = await res.json();
          pixCopiaECola = cobData.pixCopiaECola;
          usedMode = 'API_SICREDI';
          Logger.info(`[Sicredi Pix] Cobrança criada via API Sicredi: txid=${finalTxid}`);
        } else {
          const errText = await res.text();
          Logger.warn(`[Sicredi Pix] API retornou HTTP ${res.status}: ${errText}. Alternando para gerador EMV Sicredi.`);
        }
      } catch (err) {
        Logger.warn('[Sicredi Pix] Erro na chamada da API Sicredi:', { error: err.message });
      }
    }

    // Se a API oficial não gerou pixCopiaECola (ex: conta PF/CPF, sem mTLS ou erro de rede):
    // Utiliza o Gerador de Payload Padrão Banco Central EMV com valor travado e a chave do Sicredi
    if (!pixCopiaECola) {
      pixCopiaECola = generatePixCode({
        key: this.pixKey,
        name: this.beneficiario,
        city: this.cidade,
        amount: val,
        txid: finalTxid.slice(0, 25),
      });
      usedMode = 'EMV_SICREDI_STATIC';
    }

    // Gera a imagem do QR Code em Base64 Data URL para visualização imediata no PDV
    const qrCodeBase64 = await QRCode.toDataURL(pixCopiaECola, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#0f381e', // Verde Conflora
        light: '#ffffff',
      },
    });

    const chargeResult = {
      txid: finalTxid,
      pixCopiaECola,
      qrCodeBase64,
      amount: val,
      pixKey: this.pixKey,
      beneficiario: this.beneficiario,
      cidade: this.cidade,
      status: 'AGUARDANDO_PAGAMENTO',
      provider: 'SICREDI',
      mode: usedMode,
      createdAt: new Date().toISOString(),
    };

    this.localCharges.set(finalTxid, chargeResult);
    return chargeResult;
  }

  /**
   * Consulta o status de uma cobrança Pix (GET /cob/{txid}) na API do Sicredi ou no cache local.
   * @param {string} txid
   * @returns {Promise<{ status: string, isPaid: boolean, txid: string, raw?: Object }>}
   */
  async checkChargeStatus(txid) {
    if (!txid) {
      return { status: 'NOT_FOUND', isPaid: false, txid };
    }

    const token = await this.getAccessToken();
    if (token) {
      try {
        const getUrl = `${this.baseUrl}/cob/${encodeURIComponent(txid)}`;
        const res = await fetch(getUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          // @ts-ignore
          agent: this.getHttpsAgent(),
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const data = await res.json();
          const isConcluded = data.status === 'CONCLUIDA' || Boolean(data.pix && data.pix.length > 0);
          return {
            status: isConcluded ? 'PAGO' : data.status || 'AGUARDANDO_PAGAMENTO',
            isPaid: isConcluded,
            txid,
            raw: data,
          };
        }
      } catch (err) {
        Logger.warn('[Sicredi Pix] Falha ao consultar GET /cob na API Sicredi:', { error: err.message });
      }
    }

    // Consulta no cache local
    const cached = this.localCharges.get(txid);
    if (cached) {
      const isPaid = cached.status === 'PAGO' || cached.status === 'CONFIRMED' || cached.status === 'CONCLUIDA';
      return {
        status: isPaid ? 'PAGO' : cached.status,
        isPaid,
        txid,
        cached,
      };
    }

    return {
      status: 'AGUARDANDO_PAGAMENTO',
      isPaid: false,
      txid,
    };
  }

  /**
   * Marca uma cobrança como PAGA manualmente pelo operador (ex: ao conferir comprovante).
   * @param {string} txid
   */
  markAsPaid(txid) {
    const cached = this.localCharges.get(txid) || { txid };
    cached.status = 'PAGO';
    cached.paidAt = new Date().toISOString();
    this.localCharges.set(txid, cached);
    return cached;
  }
}

module.exports = {
  SicrediPixClient,
};
