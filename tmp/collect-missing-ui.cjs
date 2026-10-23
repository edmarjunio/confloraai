const fs = require('node:fs');
const path = require('node:path');
const espree = require('espree');
const sourceAliases = fs.readFileSync('public/storefront/i18n/aliases.js', 'utf8');
const aliases = JSON.parse(sourceAliases.slice(sourceAliases.indexOf('{'), sourceAliases.lastIndexOf('}') + 1));
const messages = require('../src/i18n/messages.json');
const known = new Set([...Object.keys(aliases), ...Object.keys(messages)]);
const missing = new Map();
const files = [];
function visit(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
  if (/^(?:dist|vendor|i18n|images|brands)$/.test(entry.name)) continue;
  const file = path.join(dir, entry.name);
  if (entry.isDirectory()) visit(file);
  else if (/\.(?:js|jsx|mjs)$/.test(file) && !/(?:shell|sw-built|i18n-runtime)\./.test(file)) files.push(file);
} }
visit('public');
function add(value, file) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text || known.has(text) || text.length > 1000 || !/[\p{L}]/u.test(text) ||
      /[{}<>]|https?:|^[-.#/]|[\w.+-]+@[\w.-]+\.[a-z]{2,}|=>|===|\|\||&&|\/\*|\*\//i.test(text) ||
      /^[\d\sF/.*_A-Z-]{1,12}$/.test(text) || /^[a-z_][a-z0-9_/-]*$/.test(text) || /^[a-z]+(?:[A-Z][a-z0-9]*)+$/.test(text)) return;
  const row = missing.get(text) || { pt: text, sources: [] };
  if (!row.sources.includes(file)) row.sources.push(file);
  missing.set(text, row);
}
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  let ast; try { ast = espree.parse(source, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, range: true }); } catch { continue; }
  function walk(node, ancestors = []) {
    if (!node || typeof node !== 'object') return;
    const parent = ancestors.at(-1);
    if (node.type === 'JSXText') add(node.value, file);
    if (node.type === 'Literal' && typeof node.value === 'string') {
      const property = parent?.key?.name || parent?.key?.value;
      const attribute = parent?.name?.name;
      const call = parent?.type === 'CallExpression' || parent?.type === 'NewExpression' ? parent : null;
      const callee = call?.callee?.name || call?.callee?.property?.name;
      const enclosingAttribute = ancestors.findLast(item => item.type === 'JSXAttribute');
      const skip = parent?.type === 'MemberExpression' || parent?.type === 'BinaryExpression' && parent.operator !== '+' ||
        enclosingAttribute && !/^(title|placeholder|aria-label|alt|label)$/.test(enclosingAttribute.name?.name) && !/^(alert|confirm|notify|toast|Error)$/.test(callee) ||
        parent?.type === 'Property' && (parent.key === node || /^(id|value|role|status|method|type|code|path|key|name|unit|mode)$/.test(property)) ||
        parent?.type === 'JSXAttribute' && !/^(title|placeholder|aria-label|alt|label)$/.test(attribute) ||
        ancestors.slice(-4).some(item => item.type === 'CallExpression' && /^(includes|indexOf|replace|split|querySelector|getElementById|fetch)$/.test(item.callee?.property?.name || item.callee?.name));
      const visible = parent?.type === 'JSXAttribute' || /^(label|title|description|text|bodyText|placeholder|headerText|footerText|buttonText)$/.test(property) ||
        /^(alert|confirm|notify|toast|Error|status|setCustomerError|setCustomerNotification)$/.test(callee) ||
        ancestors.slice(-12).some(item => item.type === 'JSXExpressionContainer' || item.type === 'AssignmentExpression' &&
          node.range[0] >= item.right.range[0] && node.range[1] <= item.right.range[1] && /^(textContent|innerText|title|placeholder)$/.test(item.left?.property?.name));
      if (!skip && visible) add(node.value, file);
    }
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(child => walk(child, [...ancestors, node]));
    else if (value && typeof value === 'object') walk(value, [...ancestors, node]);
  }
  walk(ast);
}
fs.writeFileSync('tmp/extra-interface-text.json', JSON.stringify([...missing.values()], null, 2));
console.log(JSON.stringify({ missing: missing.size, texts: [...missing.keys()] }));
