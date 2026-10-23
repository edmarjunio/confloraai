const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const previous = require('../src/i18n/messages.json');
const translated = require('./translated-messages.json');
const manual = {
  'cliente@email.com': { pt: 'E-mail do cliente', en: 'Customer email', es: 'Correo del cliente', fr: 'E-mail du client' },
  'Edmar Júnio': { pt: 'Administrador', en: 'Administrator', es: 'Administrador', fr: 'Administrateur' },
  'Informe a justificativa do erro para que Edmar possa avaliar.': { pt: 'Informe o motivo da correção.', en: 'Explain the reason for the correction.', es: 'Indica el motivo de la corrección.', fr: 'Indiquez le motif de la correction.' },
};
const messageFiles = [];
function visit(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
  if (/^(?:dist|vendor|i18n)$/.test(entry.name)) continue;
  const file = path.join(dir, entry.name);
  if (entry.isDirectory()) visit(file);
  else if (/\.(?:js|jsx|mjs|html)$/.test(file) && !/(?:shell|sw-built|i18n-runtime)\./.test(file)) messageFiles.push(file);
} }
visit('public'); visit('src/http');
const sources = new Map(messageFiles.map(file => [file, fs.readFileSync(file, 'utf8')]));
const joined = [...sources.values()].join('\n');
const aliasesSource = fs.readFileSync('public/storefront/i18n/aliases.js', 'utf8');
const oldAliases = JSON.parse(aliasesSource.slice(aliasesSource.indexOf('{'), aliasesSource.lastIndexOf('}') + 1));
const messages = {}, mapping = {}, aliases = {};
const slug = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\{[^}]+\}/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 85);
for (const [oldKey, entry] of Object.entries(previous)) {
  const translation = manual[entry.pt] || translated[entry.pt];
  if (!translation) {
    if (joined.includes(oldKey)) throw new Error('An active message requires a local translation: ' + oldKey);
    continue;
  }
  const value = { ...entry, ...translation };
  if (['pt', 'en', 'es', 'fr'].some(lang => typeof value[lang] !== 'string' || !value[lang])) throw new Error('Incomplete message: ' + oldKey);
  let key = oldKey.startsWith('interface_message_') ? slug(value.en) : oldKey;
  if (!/^[a-z]/.test(key)) key = 'message_' + key;
  if (!key || messages[key]) key += '_' + createHash('sha256').update(entry.pt).digest('hex').slice(0, 6);
  mapping[oldKey] = key; messages[key] = value; aliases[value.pt] = key; aliases[entry.pt] = key;
}
for (const [text, oldKey] of Object.entries(oldAliases)) if (mapping[oldKey]) aliases[text] = mapping[oldKey];
for (const [file, content] of sources) {
  let next = content;
  for (const [oldKey, key] of Object.entries(mapping)) if (oldKey !== key) next = next.replaceAll(oldKey, key);
  next = next.replaceAll('maria@conflora.com.br', 'E-mail do cliente')
    .replaceAll('Caso tenha errado no lançamento, informe o que mudou e o motivo. Edmar receberá uma notificação estilo Git Diff para aprovar.', 'Informe a correção e o motivo. O administrador vai conferir a solicitação.')
    .replaceAll('Enviar para Edmar (Git Diff)', 'Enviar para análise');
  fs.writeFileSync(file, next);
}
messages.explain_the_correction = { pt: 'Informe a correção e o motivo. O administrador vai conferir a solicitação.', en: 'Describe the correction and the reason. An administrator will review the request.', es: 'Indica la corrección y el motivo. Un administrador revisará la solicitud.', fr: 'Indiquez la correction et son motif. Un administrateur examinera la demande.' };
messages.submit_for_review = { pt: 'Enviar para análise', en: 'Submit for review', es: 'Enviar para revisión', fr: 'Soumettre à examen' };
for (const key of ['explain_the_correction', 'submit_for_review']) aliases[messages[key].pt] = key;
for (const [key, entry] of Object.entries(messages)) for (const lang of ['en', 'es', 'fr']) {
  const placeholders = entry.pt.match(/\{[a-zA-Z_]\w*\}/g) || [];
  if (placeholders.some(placeholder => !entry[lang].includes(placeholder))) throw new Error('Placeholder lost in ' + key);
}
fs.writeFileSync('src/i18n/messages.json', JSON.stringify(messages, null, 2) + '\n');
fs.writeFileSync('public/storefront/i18n/aliases.js', 'export const aliases = ' + JSON.stringify(aliases, null, 2) + ';\n');
for (const lang of ['pt', 'en', 'es', 'fr']) fs.writeFileSync(`public/storefront/i18n/${lang}.js`, `export const ${lang} = ` +
  JSON.stringify(Object.fromEntries(Object.entries(messages).map(([key, entry]) => [key, entry[lang]])), null, 2) + ';\n');
console.log(JSON.stringify({ messages: Object.keys(messages).length, languages: 4, missing: 0 }));
