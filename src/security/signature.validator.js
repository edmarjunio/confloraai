const crypto = require('node:crypto');

class SignatureValidator {
  /**
   * @param {string} appSecret
   */
  constructor(appSecret) {
    this.appSecret = appSecret;
  }

  /**
   * Validates the Meta X-Hub-Signature-256 header against the raw body buffer.
   * @param {Buffer} rawBody
   * @param {string} signatureHeader
   * @returns {boolean}
   */
  validate(rawBody, signatureHeader) {
    if (!this.appSecret) {
      // In development, if secret is omitted, bypass validation
      return process.env.NODE_ENV === 'development';
    }

    if (!rawBody || !signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const expectedHash = signatureHeader.substring(7);
    const actualHash = crypto.createHmac('sha256', this.appSecret).update(rawBody).digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'));
    } catch {
      return false;
    }
  }
}

module.exports = {
  SignatureValidator,
};
