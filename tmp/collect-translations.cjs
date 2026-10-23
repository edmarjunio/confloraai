const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const espree = require('espree');
const esbuild = require('esbuild');
const entries = new Map();
const readDictionary = lang => {
  const code = esbuild.transformSync(fs.readFileSync(`public/storefront/i18n/${lang}.js`, 'utf8'), { format: 'cjs', logLevel: 'silent' }).code;
  const context = { module: { exports: {} } }; vm.runInNewContext(code, context);
  return context.module.exports[lang];
};
const dictionaries = Object.fromEntries(['pt', 'en', 'es', 'fr'].map(lang => [lang, readDictionary(lang)]));
function add(value, file, existing) {
  const pt = String(value || '').trim();
  if (!pt || pt.length > 700 || !/[\p{L}]/u.test(pt) || /[<>]|https?:|\/api\/|\$\{|(?:^|\s)(?:const|function|return)\s|(?:px|rem|rgb|rgba)\b|^[-.#/]|\b(?:DOCTYPE|svg|path|xmlns)\b/.test(pt)) return;
  if (!existing && !/[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]|\b(?:de|da|do|das|dos|para|com|sem|seu|sua|ou|em|que|por|um|uma|ao|na|no|os|as|mais|menos|salvar|entrar|sair|voltar|cancelar|produto|produtos|cliente|clientes|venda|vendas|estoque|pagamento|total|pedido|pedidos|sacola|caixa|entrega|retirada|carregando|erro|buscar|nome|alterar|adicionar|excluir|selecionar|confirmar)\b/i.test(pt)) return;
  if (/^[A-Z0-9_]+$/.test(pt) && !existing) return;
  const entry = entries.get(pt) || { pt, sources: [] };
  if (existing) Object.assign(entry, existing);
  if (!entry.sources.includes(file)) entry.sources.push(file);
  entries.set(pt, entry);
}
for (const [key, value] of Object.entries(dictionaries.pt)) add(value, 'dictionary', {
  oldKeys: [key], en: dictionaries.en[key], es: dictionaries.es[key], fr: dictionaries.fr[key],
});
const files = [];
function visit(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (/^(?:dist|vendor|images|brands|i18n)$/.test(item.name)) continue;
    const file = path.join(directory, item.name);
    if (item.isDirectory()) visit(file);
    else if (/\.(?:js|jsx|mjs|html)$/.test(file) && !/(?:shell|sw-built|i18n-runtime)\./.test(file)) files.push(file.replaceAll('\\', '/'));
  }
}
visit('public'); visit('src/http');
function scanHtml(source, file) {
  const visible = source.replace(/<(?:style|script)\b[^>]*>[^]*?<\/(?:style|script)>/gi, '');
  for (const match of visible.matchAll(/>([^<>]+)</g)) for (const line of match[1].split(/\r?\n/)) add(line.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'), file);
  for (const match of visible.matchAll(/(?:placeholder|title|aria-label)=["']([^"']+)["']/g)) add(match[1], file);
}
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  scanHtml(source, file);
  if (file.endsWith('.html')) continue;
  let ast;
  try { ast = espree.parse(source, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, range: true }); }
  catch { continue; }
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Literal' && typeof node.value === 'string') add(node.value, file);
    if (node.type === 'JSXText') add(node.value.replace(/\s+/g, ' '), file);
    if (node.type === 'TemplateElement') {
      const raw = node.value.cooked || node.value.raw;
      scanHtml(raw, file);
      if (!/[<>{};=]/.test(raw)) add(raw, file);
      for (const match of raw.matchAll(/(['"])([^'"\r\n]{2,500})\1/g)) add(match[2], file);
    }
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value);
  };
  walk(ast);
}
fs.writeFileSync('tmp/translation-corpus.json', JSON.stringify([...entries.values()], null, 2));
console.log(JSON.stringify({ files: files.length, entries: entries.size, missingEnglish: [...entries.values()].filter(entry => !entry.en).length }));
