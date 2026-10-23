const test = require('node:test');
const assert = require('node:assert/strict');
const espree = require('espree');
const { renderAdminHtml, renderAdminGerencialHtml, renderCaixaHtml } = require('../src/http/views');
const { renderPrivacyPolicyHtml, renderDataDeletionHtml, renderTermsOfServiceHtml } = require('../src/http/app');

test('all translated server pages render syntactically valid inline scripts', () => {
  for (const render of [renderAdminHtml, renderAdminGerencialHtml, renderCaixaHtml, renderPrivacyPolicyHtml, renderDataDeletionHtml, renderTermsOfServiceHtml]) {
    const html = render();
    for (const match of html.matchAll(/<script(?:\s[^>]*)?>([^]*?)<\/script>/g)) {
      if (!match[1].trim()) continue;
      assert.doesNotThrow(() => espree.parse(match[1], { ecmaVersion: 'latest', sourceType: 'module', loc: true }), render.name);
    }
    assert.ok(!html.includes('interface_message_'), render.name);
  }
});

test('every interface key has four translations and preserves interpolation parameters', () => {
  const messages = require('../src/i18n/messages.json');
  for (const [key, entry] of Object.entries(messages)) {
    assert.match(key, /^[a-z][a-z0-9_]*$/, key);
    for (const language of ['pt', 'en', 'es', 'fr']) {
      assert.ok(typeof entry[language] === 'string' && entry[language], key + ':' + language);
      for (const parameter of entry.pt.match(/\{[a-zA-Z_]\w*\}/g) || []) assert.ok(entry[language].includes(parameter), key + ':' + parameter);
    }
  }
});
