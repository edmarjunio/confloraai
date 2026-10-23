const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const espree = require('espree');
const esbuild = require('esbuild');
const { createHash } = require('node:crypto');
const corpus = require('./translation-corpus.json');
const dictionaries = {};
for (const lang of ['pt', 'en', 'es', 'fr']) {
  const context = { module: { exports: {} } };
  vm.runInNewContext(esbuild.transformSync(fs.readFileSync(`public/storefront/i18n/${lang}.js`, 'utf8'), { format: 'cjs', logLevel: 'silent' }).code, context);
  dictionaries[lang] = context.module.exports[lang];
}
const translated = fs.existsSync('tmp/translated-messages.json') ? JSON.parse(fs.readFileSync('tmp/translated-messages.json')) : {};
const messages = {}, aliases = {}, used = new Set();
const digest = text => createHash('sha256').update(text).digest('hex').slice(0, 10);
const slug = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\{[^}]+\}/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 85);
for (const entry of corpus) {
  if (/\.(?:js|jsx|html|css)$/.test(entry.pt)) continue;
  const oldKey = Object.keys(dictionaries.pt).find(key => dictionaries.pt[key] === entry.pt);
  const original = Object.fromEntries(['en', 'es', 'fr'].map(lang => [lang, dictionaries[lang][oldKey] || dictionaries[lang][entry.pt] || entry[lang]]));
  const values = { pt: entry.pt, ...original, ...translated[entry.pt] };
  let key = oldKey && /^[a-z_]+\.[a-z_.]+$/.test(oldKey) ? oldKey.replaceAll('.', '_')
    : values.en && /[a-z]/i.test(values.en) ? slug(values.en) : `interface_message_${digest(entry.pt)}`;
  if (!key || used.has(key)) key = `${key || 'interface_message'}_${digest(entry.pt)}`;
  used.add(key); messages[key] = values; aliases[entry.pt] = key;
}
for (const [oldKey, pt] of Object.entries(dictionaries.pt)) if (aliases[pt]) aliases[oldKey] = aliases[pt];
for (const oldKey of Object.keys(dictionaries.en)) if (aliases[oldKey]) {
  const message = messages[aliases[oldKey]];
  for (const lang of ['en', 'es', 'fr']) message[lang] ||= dictionaries[lang][oldKey];
}
fs.mkdirSync('src/i18n', { recursive: true });
fs.writeFileSync('src/i18n/messages.json', JSON.stringify(messages, null, 2) + '\n');
fs.writeFileSync('public/storefront/i18n/aliases.js', 'export const aliases = ' + JSON.stringify(aliases, null, 2) + ';\n');
for (const lang of ['pt', 'en', 'es', 'fr']) fs.writeFileSync(`public/storefront/i18n/${lang}.js`, `export const ${lang} = ` +
  JSON.stringify(Object.fromEntries(Object.entries(messages).filter(([, value]) => value[lang]).map(([key, value]) => [key, value[lang]])), null, 2) + ';\n');
function keyFor(value) { return aliases[String(value).trim()]; }
const expression = value => `'${keyFor(value)}'.tr`;
const preservePadding = (value, content) => (value.match(/^\s*/)?.[0] || '') + content + (value.match(/\s*$/)?.[0] || '');
function translateHtmlText(raw, server = false) {
  return raw.replace(/>([^<>]*)(?=<|$)/g, (match, text) => {
    if (!keyFor(text)) return match;
    return '>' + preservePadding(text, '${' + expression(text) + '}');
  });
}
function skipLiteral(node, parent) {
  if (!parent) return true;
  if (parent.type === 'Property' && parent.key === node && !parent.computed) return true;
  if (['ImportDeclaration', 'ExportNamedDeclaration', 'BinaryExpression', 'SwitchCase'].includes(parent.type)) return true;
  if (parent.type === 'Property' && /^(?:id|value|role|status|method|type|field|code|path|key|name|unit|mode|paymentMethod|orderType)$/.test(parent.key.name || parent.key.value)) return true;
  if (parent.type === 'JSXAttribute' && !/^(?:title|placeholder|aria-label|alt|label)$/.test(parent.name.name)) return true;
  return false;
}
const files = [];
function visit(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (/^(?:dist|vendor|i18n|images|brands)$/.test(item.name)) continue;
    const file = path.join(directory, item.name);
    if (item.isDirectory()) visit(file);
    else if (/\.(?:js|jsx|mjs)$/.test(file) && !/(?:sw-built|i18n-runtime)\./.test(file)) files.push(file);
  }
}
visit('public');
for (const name of fs.readdirSync('src/http')) if (/^(?:views.*|firebase-client|app)\.js$/.test(name)) files.push(path.join('src/http', name));
let replacements = 0;
for (const file of files) {
  const server = file.startsWith('src');
  const source = fs.readFileSync(file, 'utf8');
  let ast;
  try { ast = espree.parse(source, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, range: true }); } catch { continue; }
  const edits = [];
  function walk(node, parent) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Literal' && typeof node.value === 'string' && keyFor(node.value) && !skipLiteral(node, parent)) {
      const suffix = source.slice(node.range[1], node.range[1] + 3);
      let replacement = suffix === '.tr' ? `'${keyFor(node.value)}'` : expression(node.value);
      if (parent.type === 'JSXAttribute') replacement = '{' + replacement + '}';
      edits.push({ start: node.range[0], end: node.range[1], replacement });
    } else if (node.type === 'JSXText' && keyFor(node.value.replace(/\s+/g, ' '))) {
      const normalized = node.value.replace(/\s+/g, ' ');
      edits.push({ start: node.range[0], end: node.range[1], replacement: preservePadding(normalized, '{' + expression(normalized) + '}') });
    } else if (node.type === 'TemplateElement') {
      const raw = node.value.raw;
      let next = raw;
      if (raw.includes('<')) {
        next = translateHtmlText(raw, server);
      } else if (keyFor(raw)) next = preservePadding(raw, '${' + expression(raw) + '}');
      if (next !== raw) {
        const start = source.indexOf(raw, node.range[0]);
        if (start >= node.range[0] && start + raw.length <= node.range[1]) edits.push({ start, end: start + raw.length, replacement: next });
      }
    }
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(child => walk(child, node));
    else if (value && typeof value === 'object') walk(value, node);
  }
  walk(ast, null);
  let next = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) next = next.slice(0, edit.start) + edit.replacement + next.slice(edit.end);
  if (server && !next.includes("require('../i18n/default')")) next = "require('../i18n/default');\n" + next;
  if (next !== source) { fs.writeFileSync(file, next); replacements += edits.length; }
}
fs.writeFileSync('tmp/i18n-migration-report.json', JSON.stringify({ messages: Object.keys(messages).length, replacements,
  missing: Object.entries(messages).filter(([, value]) => !value.en || !value.es || !value.fr).map(([key]) => key) }, null, 2));
console.log(JSON.stringify({ messages: Object.keys(messages).length, replacements }));
