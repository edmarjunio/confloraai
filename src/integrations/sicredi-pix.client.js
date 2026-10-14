const https = require('node:https');
const crypto = require('node:crypto');
const fs = require('node:fs');
const QRCode = require('qrcode');

function moneyCents(value) {
  const text = String(value);
  if (!/^\d+\.\d{2}$/.test(text)) { throw new Error('Valor monetário inválido.'); }
  const cents = Number(text.replace('.', ''));
  if (!Number.isSafeInteger(cents) || cents <= 0) { throw new Error('Valor monetário inválido.'); }
  return cents;
}

/** HTTPS nativo: fetch do Node ignora a opção agent e não aplica mTLS. */
function requestJson(url, { method = 'GET', headers = {}, body, agent }) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method, headers, agent }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        text += chunk;
        if (text.length > 1024 * 1024) { request.destroy(new Error('Resposta bancária excedeu o limite.')); }
      });
      response.on('error', reject);
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(`Sicredi indisponível (HTTP ${response.statusCode}).`);
          error.status = response.statusCode;
          return reject(error);
        }
        try { resolve(text ? JSON.parse(text) : {}); } catch { reject(new Error('Resposta bancária inválida.')); }
      });
    });
    const deadline = setTimeout(() => request.destroy(new Error('Tempo limite na API Sicredi.')), 15000);
    request.on('close', () => clearTimeout(deadline));
    request.on('error', reject);
    request.end(body);
  });
}

class SicrediPixClient {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || process.env.SICREDI_PIX_BASE_URL || 'https://api-pix.sicredi.com.br/api/v2').replace(/\/$/, '');
    this.authUrl = options.authUrl || process.env.SICREDI_OAUTH_URL || 'https://api-pix.sicredi.com.br/oauth/token';
    this.clientId = options.clientId ?? process.env.SICREDI_CLIENT_ID ?? '';
    this.clientSecret = options.clientSecret ?? process.env.SICREDI_CLIENT_SECRET ?? '';
    this.pixKey = options.pixKey ?? process.env.SICREDI_PIX_KEY ?? '';
    const readPem = (value, path) => value || (path ? fs.readFileSync(path, 'utf8') : '');
    this.certificate = options.certificate ?? readPem(process.env.SICREDI_CERT_PEM, process.env.SICREDI_CERT_PATH);
    this.privateKey = options.privateKey ?? readPem(process.env.SICREDI_KEY_PEM, process.env.SICREDI_KEY_PATH);
    const ca = options.ca ?? readPem(process.env.SICREDI_CA_PEM, process.env.SICREDI_CA_PATH);
    this.agent = new https.Agent({ cert: this.certificate, key: this.privateKey, ...(ca ? { ca } : {}), rejectUnauthorized: true, keepAlive: true });
    this.transport = options.transport || requestJson;
    this.token = null;
    this.tokenExpiresAt = 0;
    for (const url of [this.baseUrl, this.authUrl]) {
      if (new URL(url).protocol !== 'https:') { throw new Error('Sicredi exige HTTPS.'); }
    }
  }

  get isOfficialApiConfigured() {
    return Boolean(this.clientId && this.clientSecret && this.pixKey && this.certificate && this.privateKey);
  }

  generateTxId() { return crypto.randomBytes(16).toString('hex'); }

  async getAccessToken() {
    if (!this.isOfficialApiConfigured) { throw new Error('Configure credenciais, chave recebedora e certificado mTLS Sicredi.'); }
    if (this.token && Date.now() < this.tokenExpiresAt) { return this.token; }
    if (this.tokenRequest) { return this.tokenRequest; }
    this.tokenRequest = (async () => {
      const data = await this.transport(this.authUrl, {
        method: 'POST', agent: this.agent,
        headers: { Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'cob.read cob.write pix.read webhook.read webhook.write' }).toString(),
      });
      if (!data.access_token || !Number.isFinite(Number(data.expires_in))) { throw new Error('Token Sicredi inválido.'); }
      this.token = data.access_token;
      this.tokenExpiresAt = Date.now() + Math.max(0, Math.min(Number(data.expires_in), 3600) - 60) * 1000;
      return this.token;
    })();
    try { return await this.tokenRequest; } finally { this.tokenRequest = null; }
  }

  async request(path, method = 'GET', payload, retry = true) {
    const token = await this.getAccessToken();
    try {
      return await this.transport(`${this.baseUrl}${path}`, {
        method, agent: this.agent,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
      });
    } catch (error) {
      if (error.status !== 401 || !retry) { throw error; }
      this.token = null;
      return this.request(path, method, payload, false);
    }
  }

  async getCharge(txid) {
    if (!/^[a-zA-Z0-9]{26,35}$/.test(txid)) { throw new Error('txid inválido.'); }
    return this.request(`/cob/${txid}`);
  }

  async createCharge({ amount, txid = this.generateTxId(), description = '' }) {
    const original = Number(amount).toFixed(2);
    moneyCents(original);
    let charge;
    try { charge = await this.getCharge(txid); } catch (error) {
      if (error.status !== 404) { throw error; }
      charge = await this.request(`/cob/${txid}`, 'PUT', {
        calendario: { expiracao: 3600 }, valor: { original, modalidadeAlteracao: 0 },
        chave: this.pixKey, solicitacaoPagador: description.slice(0, 140),
      });
    }
    if (charge.txid !== txid || charge.chave !== this.pixKey || moneyCents(charge.valor?.original) !== moneyCents(original) || !charge.pixCopiaECola) {
      throw new Error('Cobrança Sicredi divergente da venda.');
    }
    return {
      txid, pixCopiaECola: charge.pixCopiaECola,
      qrCodeBase64: await QRCode.toDataURL(charge.pixCopiaECola, { width: 320, margin: 2 }),
      amount: Number(original), pixKey: this.pixKey, provider: 'SICREDI', mode: 'API_SICREDI',
      status: charge.status, expiresAt: new Date(Date.parse(charge.calendario?.criacao) + Number(charge.calendario?.expiracao || 3600) * 1000).toISOString(),
    };
  }

  async checkChargeStatus(txid, { total, pixKey }) {
    const charge = await this.getCharge(txid);
    const expected = moneyCents(Number(total).toFixed(2));
    if (pixKey !== this.pixKey || charge.txid !== txid || charge.chave !== pixKey || moneyCents(charge.valor?.original) !== expected) {
      throw new Error('Identificação ou valor da cobrança divergente.');
    }
    if (charge.status !== 'CONCLUIDA') { return { isPaid: false, status: charge.status, txid }; }
    // Status isolado e conteúdo do webhook nunca autorizam baixa.
    if (!Array.isArray(charge.pix) || charge.pix.length !== 1) { throw new Error('Liquidação ausente ou múltipla: exige conciliação.'); }
    const entry = charge.pix[0];
    if (!/^E[a-zA-Z0-9]{31}$/.test(entry.endToEndId || '')) { throw new Error('Liquidação sem endToEndId válido.'); }
    const receipt = await this.request(`/pix/${entry.endToEndId}`);
    if (receipt.endToEndId !== entry.endToEndId || receipt.txid !== txid || moneyCents(receipt.valor) !== expected ||
        moneyCents(entry.valor) !== expected || !Number.isFinite(Date.parse(receipt.horario)) ||
        (receipt.devolucoes?.length || entry.devolucoes?.length)) {
      throw new Error('Recebimento divergente ou com devolução: exige conciliação.');
    }
    return { isPaid: true, status: 'PAGO', txid, endToEndId: receipt.endToEndId, amount: expected / 100, paidAt: receipt.horario, pixKey };
  }

  registerWebhook(webhookURL) {
    if (new URL(webhookURL).protocol !== 'https:') { throw new Error('Webhook exige HTTPS.'); }
    return this.request(`/webhook/${encodeURIComponent(this.pixKey)}`, 'PUT', { webhookURL });
  }
}

module.exports = { SicrediPixClient, moneyCents, requestJson };
