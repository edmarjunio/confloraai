const https = require('node:https');
const { randomBytes } = require('node:crypto');
const QRCode = require('qrcode');

// Native HTTPS: Node fetch does not support https.Agent for mTLS.
function requestJson(url, options) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, options, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('error', reject);
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(new Error('Sicredi indisponível (HTTP ' + response.statusCode + ').'));
        }
        try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Resposta inválida do Sicredi.')); }
      });
    });
    request.setTimeout(15000, () => request.destroy(new Error('Tempo limite do Sicredi.')));
    request.on('error', reject);
    request.end(options.body);
  });
}

class SicrediPixClient {
  constructor({
    baseUrl = process.env.SICREDI_PIX_BASE_URL || 'https://api-pix.sicredi.com.br/api/v2',
    authUrl = process.env.SICREDI_OAUTH_URL || 'https://api-pix.sicredi.com.br/oauth/token',
    clientId = process.env.SICREDI_CLIENT_ID || '', clientSecret = process.env.SICREDI_CLIENT_SECRET || '',
    certificate = process.env.SICREDI_CERT_PEM || '', privateKey = process.env.SICREDI_KEY_PEM || '',
    pixKey = process.env.SICREDI_PIX_KEY || '', request = requestJson,
  } = {}) {
    Object.assign(this, { baseUrl: baseUrl.replace(/\/$/, ''), authUrl, clientId, clientSecret, certificate, privateKey, pixKey, request });
    this.tokenExpiresAt = 0;
  }
  get isOfficialApiConfigured() {
    return Boolean(this.clientId && this.clientSecret && this.certificate && this.privateKey && this.pixKey);
  }
  generateTxId() { return randomBytes(16).toString('hex'); }
  async getAccessToken() {
    if (!this.isOfficialApiConfigured) { throw new Error('Configure credenciais, certificado, chave privada e chave Pix do Sicredi.'); }
    if (this.token && Date.now() < this.tokenExpiresAt) { return this.token; }
    const data = await this.request(this.authUrl, {
      method: 'POST', cert: this.certificate, key: this.privateKey,
      headers: { Authorization: 'Basic ' + Buffer.from(this.clientId + ':' + this.clientSecret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'cob.read cob.write pix.read webhook.read webhook.write' }).toString(),
    });
    if (!data.access_token) { throw new Error('Token Sicredi não recebido.'); }
    this.token = data.access_token;
    this.tokenExpiresAt = Date.now() + 60000;
    return this.token;
  }
  async call(method, path, body) {
    const token = await this.getAccessToken();
    return this.request(this.baseUrl + path, {
      method, cert: this.certificate, key: this.privateKey,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  async createCharge({ amount, txid = this.generateTxId(), ticketNumber = '' }) {
    if (!Number.isFinite(amount) || amount <= 0 || !/^[a-zA-Z0-9]{26,35}$/.test(txid)) { throw new Error('Cobrança Pix inválida.'); }
    let data;
    try {
      data = await this.call('PUT', '/cob/' + txid, {
        calendario: { expiracao: 3600 }, valor: { original: amount.toFixed(2), modalidadeAlteracao: 0 },
        chave: this.pixKey, solicitacaoPagador: 'Pedido Conflora #' + ticketNumber,
      });
    } catch (error) {
      // A timeout can happen after the bank persisted the charge. Recover by txid.
      const existing = await this.call('GET', '/cob/' + txid);
      if (existing.txid !== txid || existing.chave !== this.pixKey || Number(existing.valor?.modalidadeAlteracao) !== 0 || Math.round(Number(existing.valor?.original) * 100) !== Math.round(amount * 100)) { throw error; }
      data = existing;
    }
    if (!data.pixCopiaECola || data.txid !== txid) { throw new Error('Sicredi não retornou a cobrança solicitada.'); }
    return { txid, pixCopiaECola: data.pixCopiaECola, amount, provider: 'SICREDI', mode: 'API_SICREDI',
      qrCodeBase64: await QRCode.toDataURL(data.pixCopiaECola, { width: 320, margin: 2 }), status: 'ATIVA' };
  }
  async checkChargeStatus(txid) {
    if (!/^[a-zA-Z0-9]{26,35}$/.test(txid)) { throw new Error('Identificador Pix inválido.'); }
    const raw = await this.call('GET', '/cob/' + txid);
    return { txid, raw, isPaid: raw.txid === txid && raw.status === 'CONCLUIDA' };
  }
}
module.exports = { SicrediPixClient, requestJson };
