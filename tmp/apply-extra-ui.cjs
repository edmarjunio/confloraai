const fs = require('node:fs');
const path = require('node:path');
const espree = require('espree');
const { createHash } = require('node:crypto');
const messages = require('../src/i18n/messages.json');
const translations = require('./translated-messages.json');
const aliasSource = fs.readFileSync('public/storefront/i18n/aliases.js', 'utf8');
const aliases = JSON.parse(aliasSource.slice(aliasSource.indexOf('{'), aliasSource.lastIndexOf('}') + 1));
const additions = require('./extra-interface-text.json');
const slug = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 85);
for (const { pt } of additions) {
  if (aliases[pt] || ['pt-BR', 'Pix', 'R$'].includes(pt)) continue;
  const translation = translations[pt];
  if (!translation) throw new Error('Missing interface translation: ' + pt);
  let key = slug(translation.en);
  if (!/^[a-z]/.test(key)) key = 'label_' + key;
  if (messages[key]) key += '_' + createHash('sha256').update(pt).digest('hex').slice(0, 6);
  messages[key] = { pt, ...translation }; aliases[pt] = key;
}
Object.assign(messages, {
  product_details: { pt: 'Detalhes', en: 'Details', es: 'Detalles', fr: 'Détails' },
  product_feeding: { pt: 'Alimentação', en: 'Feeding', es: 'Alimentación', fr: 'Alimentation' },
  product_durability: { pt: 'Durabilidade', en: 'Durability', es: 'Durabilidad', fr: 'Durabilité' },
  staff_member: { pt: 'Colaborador', en: 'Staff member', es: 'Colaborador', fr: 'Collaborateur' },
  product_no_additional_information: { pt: 'Nenhuma informação adicional cadastrada.', en: 'No additional information registered.', es: 'No hay información adicional registrada.', fr: 'Aucune information supplémentaire enregistrée.' },
});
for (const [key, value] of Object.entries(messages)) aliases[value.pt] ||= key;
const files = [];
function visit(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
  if (/^(?:dist|vendor|i18n|images|brands)$/.test(entry.name)) continue;
  const file = path.join(dir, entry.name);
  if (entry.isDirectory()) visit(file);
  else if (/\.(?:js|jsx|mjs)$/.test(file) && !/(?:shell|sw-built|i18n-runtime)\./.test(file)) files.push(file);
} }
visit('public');
const normalize = value => value.trim().replace(/\s+/g, ' ');
const machine = new Set(['ADMIN', 'CAIXA', 'VENDEDOR', 'ENTREGADOR', 'CLIENTE', 'ATIVO', 'INATIVO', 'PIX', 'DINHEIRO', 'CREDITO', 'DEBITO', 'FIADO', 'Cliente Balcão']);
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  let ast; try { ast = espree.parse(source, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, range: true }); } catch { continue; }
  const edits = [];
  function walk(node, ancestors = []) {
    if (!node || typeof node !== 'object') return;
    const parent = ancestors.at(-1);
    if (node.type === 'JSXText' && aliases[normalize(node.value)]) {
      edits.push({ start: node.range[0], end: node.range[1], text: ` {'${aliases[normalize(node.value)]}'.tr} ` });
    }
    if (node.type === 'Literal' && typeof node.value === 'string' && aliases[normalize(node.value)] && !machine.has(node.value)) {
      const property = parent?.key?.name || parent?.key?.value;
      const call = parent?.type === 'CallExpression' || parent?.type === 'NewExpression' ? parent : null;
      const callee = call?.callee?.name || call?.callee?.property?.name;
      const enclosingAttribute = ancestors.findLast(item => item.type === 'JSXAttribute');
      const skip = parent?.type === 'MemberExpression' || parent?.type === 'BinaryExpression' && parent.operator !== '+' ||
        enclosingAttribute && !/^(title|placeholder|aria-label|alt|label)$/.test(enclosingAttribute.name?.name) && !/^(alert|confirm|notify|toast|Error)$/.test(callee) ||
        parent?.type === 'Property' && (parent.key === node || /^(id|value|role|status|method|type|code|path|key|name|unit|mode)$/.test(property)) ||
        ancestors.slice(-4).some(item => item.type === 'CallExpression' && /^(includes|indexOf|replace|split|querySelector|getElementById|fetch)$/.test(item.callee?.property?.name || item.callee?.name));
      const visible = parent?.type === 'JSXAttribute' || /^(label|title|description|text|bodyText|placeholder|headerText|footerText|buttonText)$/.test(property) ||
        /^(alert|confirm|notify|toast|Error|status|setCustomerError|setCustomerNotification)$/.test(callee) ||
        ancestors.slice(-12).some(item => item.type === 'JSXExpressionContainer' || item.type === 'AssignmentExpression' &&
          node.range[0] >= item.right.range[0] && node.range[1] <= item.right.range[1] && /^(textContent|innerText|title|placeholder)$/.test(item.left?.property?.name));
      if (!skip && visible) {
        let text = `'${aliases[normalize(node.value)]}'.tr`;
        const before = node.value.match(/^\s*/)[0], after = node.value.match(/\s*$/)[0];
        if (before) text = JSON.stringify(before) + ' + ' + text;
        if (after) text += ' + ' + JSON.stringify(after);
        if (parent.type === 'JSXAttribute') text = '{' + text + '}';
        edits.push({ start: node.range[0], end: node.range[1], text });
      }
    }
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(child => walk(child, [...ancestors, node]));
    else if (value && typeof value === 'object') walk(value, [...ancestors, node]);
  }
  walk(ast);
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  fs.writeFileSync(file, output);
}
fs.writeFileSync('src/i18n/messages.json', JSON.stringify(messages, null, 2) + '\n');
fs.writeFileSync('public/storefront/i18n/aliases.js', 'export const aliases = ' + JSON.stringify(aliases, null, 2) + ';\n');
for (const language of ['pt', 'en', 'es', 'fr']) fs.writeFileSync(`public/storefront/i18n/${language}.js`, `export const ${language} = ` +
  JSON.stringify(Object.fromEntries(Object.entries(messages).map(([key, value]) => [key, value[language]])), null, 2) + ';\n');
console.log(JSON.stringify({ messages: Object.keys(messages).length, missing: 0 }));
