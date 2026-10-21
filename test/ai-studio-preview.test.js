const test = require('node:test');
const assert = require('node:assert/strict');
const { contentSecurityPolicy, installRequestProtection } = require('../src/security/request-protection');

test('AI Studio embedding requires an explicit development opt-in and keeps other CSP protections', () => {
  assert.equal(contentSecurityPolicy({ NODE_ENV: 'development' }), "frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
  assert.equal(contentSecurityPolicy({ NODE_ENV: 'development', AI_STUDIO_PREVIEW_EMBED: 'true' }), "frame-ancestors 'self' https://aistudio.google.com; object-src 'none'; base-uri 'self'");
  for (const NODE_ENV of ['production', 'test', 'staging']) {
    assert.equal(contentSecurityPolicy({ NODE_ENV, AI_STUDIO_PREVIEW_EMBED: 'true' }), "frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
  }
});

test('security middleware sends the restrictive default without trusting request headers', () => {
  const handlers = [];
  installRequestProtection({ use: (...args) => handlers.push(args.at(-1)) }, {});
  const headers = {};
  let proceeded = false;
  handlers[0]({ headers: { origin: 'https://aistudio.google.com', 'x-forwarded-host': 'aistudio.google.com' } },
    { setHeader: (key, value) => { headers[key] = value; } }, () => { proceeded = true; });
  assert.equal(headers['Content-Security-Policy'], "frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.ok(proceeded);
});
