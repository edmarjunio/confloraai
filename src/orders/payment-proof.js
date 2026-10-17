const { randomUUID } = require('node:crypto');
const config = require('../config/env');

const MAX_BYTES = 3 * 1024 * 1024;

function decodeProof(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('Envie uma foto JPG, PNG, WebP ou um comprovante PDF.');
  const buffer = Buffer.from(match[2], 'base64');
  const valid = match[1] === 'application/pdf' ? buffer.subarray(0, 5).toString() === '%PDF-'
    : match[1] === 'image/jpeg' ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
      : match[1] === 'image/png' ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  if (!valid || !buffer.length || buffer.length > MAX_BYTES) throw new Error('Comprovante inválido. O limite é 3 MB.');
  return { buffer, contentType: match[1] };
}

function privateBucket() {
  const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');
  const { getStorage } = require('firebase-admin/storage');
  const name = 'conflora-payment-proofs';
  const app = getApps().find((entry) => entry.name === name) || initializeApp({
    projectId: config.firebase.projectId, storageBucket: config.firebase.storageBucket,
    credential: config.gcp.keyFilename ? cert(config.gcp.keyFilename) : applicationDefault(),
  }, name);
  return getStorage(app).bucket(config.firebase.storageBucket);
}

class PaymentProofStorage {
  constructor({ inMemory = false } = {}) { this.inMemory = inMemory; this.files = new Map(); }
  async save(dataUrl) {
    const { buffer, contentType } = decodeProof(dataUrl);
    const id = randomUUID(); const path = `payment-proofs/${id}`;
    if (this.inMemory) this.files.set(path, buffer);
    else {
      if (process.env.NODE_ENV === 'test') throw new Error('Storage real desabilitado nos testes.');
      await privateBucket().file(path).save(buffer, { resumable: false, metadata: { contentType, cacheControl: 'private, no-store' } });
    }
    return { id, path, contentType, size: buffer.length };
  }
  async read(path) {
    if (!/^payment-proofs\/[a-f0-9-]{36}$/.test(path || '')) throw new Error('Comprovante inválido.');
    if (this.inMemory) return this.files.get(path);
    if (process.env.NODE_ENV === 'test') throw new Error('Storage real desabilitado nos testes.');
    return (await privateBucket().file(path).download())[0];
  }
}

async function requireManualProof(tx, verification, receiver, targetType, targetId) {
  const proofId = String(verification?.manualPixProofId || '');
  const proof = /^[a-f0-9-]{36}$/.test(proofId) ? await tx.get('payment_proofs', proofId) : null;
  if (!proof || proof.uploadedBy !== receiver?.id || proof.targetType !== targetType || proof.targetId !== targetId) {
    throw new Error('Anexe obrigatoriamente a foto ou o PDF do comprovante deste pagamento.');
  }
  return { id: proof.id, fileName: proof.fileName, contentType: proof.contentType, size: proof.size };
}

module.exports = { PaymentProofStorage, requireManualProof, decodeProof };
