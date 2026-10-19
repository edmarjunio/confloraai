const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(scrypt);

async function hashCredential(value) {
  if (typeof value !== 'string' || !value || value.length > 128) throw new Error('Credencial inválida.');
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await derive(value, salt, 64)).toString('hex')}`;
}

async function verifyCredential(value, encoded, legacy) {
  if (typeof value !== 'string' || value.length > 128) return false;
  if (encoded) {
    const [scheme, salt, expected] = encoded.split(':');
    if (scheme !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(expected || '')) return false;
    return timingSafeEqual(await derive(value, salt, 64), Buffer.from(expected, 'hex'));
  }
  if (typeof legacy !== 'string') return false;
  const left = Buffer.from(value); const right = Buffer.from(legacy);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function protectCredentials(input, previous = {}) {
  const result = { ...input };
  for (const name of ['password', 'pin']) {
    const hashName = `${name}Hash`;
    if (typeof result[name] === 'string' && result[name]) result[hashName] = await hashCredential(result[name]);
    else if (!result[hashName] && previous[hashName]) result[hashName] = previous[hashName];
    else if (!result[hashName] && previous[name]) result[hashName] = await hashCredential(previous[name]);
    delete result[name];
  }
  return result;
}
module.exports = { hashCredential, verifyCredential, protectCredentials };
