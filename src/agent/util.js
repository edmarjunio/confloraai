'use strict';
const crypto = require('node:crypto');
const { normalizeText } = require('../shared/string.util');

const NAME_FILLER = new Set(['de', 'da', 'do', 'das', 'dos']);

/** Normaliza nome para comparação: sem acentos, caixa, pontuação; "200 g" == "200g"; "1,5kg" == "1.5kg". */
function normalizeName(value) {
  if (typeof value !== 'string') return '';
  const prepared = value
    .replace(/(\d)[.,](\d)/g, '$1p$2')
    .replace(/(\d)\s+(g|kg|ml|l|cm|m|un)\b/gi, '$1$2');
  return normalizeText(prepared);
}

function singularToken(token) {
  return token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token;
}

/** Tokens comparáveis (singular, sem preposições). A ordem é preservada. */
function nameTokens(value) {
  return normalizeName(value)
    .split(' ')
    .filter((t) => t && !NAME_FILLER.has(t))
    .map(singularToken);
}

/** Chave independente da ordem das palavras: nome normalizado "equivalente". */
function tokenKey(value) {
  return [...new Set(nameTokens(value))].sort().join(' ');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function safeEqualText(a, b) {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

function newRequestId() {
  return `req_${crypto.randomUUID()}`;
}

class TimeoutError extends Error {
  constructor(label, ms) {
    super(`Tempo limite de ${ms}ms excedido em ${label}.`);
    this.name = 'TimeoutError';
    this.code = 'TIMEOUT';
  }
}

/** Rejeita ao atingir o prazo. Não cancela a operação subjacente (o chamador trata o resultado como falha). */
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

const TRANSIENT_CODES = new Set([4, 8, 10, 13, 14, 'unavailable', 'deadline-exceeded', 'aborted', 'resource-exhausted', 'TIMEOUT']);

function isTransient(error) {
  return Boolean(error) && (TRANSIENT_CODES.has(error.code) || /UNAVAILABLE|DEADLINE_EXCEEDED|ABORTED/.test(String(error.message)));
}

/** Retentativas limitadas apenas para erros transitórios. NÃO usar em escrita sem idempotência. */
async function retryTransient(fn, { attempts = 2, delayMs = 50 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastError;
}

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Texto seguro para exibir ao cliente: remove formatação do WhatsApp, controles e limita o tamanho. */
function safeDisplayText(value, max = 120) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

module.exports = {
  normalizeName, nameTokens, tokenKey, singularToken, sha256, safeEqualText, canonicalJson,
  newRequestId, TimeoutError, withTimeout, isTransient, retryTransient, toIso, safeDisplayText,
};
