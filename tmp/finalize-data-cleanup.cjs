const fs = require('node:fs');
const edit = (file, change) => fs.writeFileSync(file, change(fs.readFileSync(file, 'utf8')));

edit('src/catalog/image-resolver.js', source => source.slice(source.indexOf('/**\n * Detecta se o item'))
  .replace('  FALLBACK_HD_IMAGES,', '')
  .replace('  resolveHdProductImage,', "  resolveHdProductImage: () => '/store-assets/placeholder.svg',"));
edit('src/catalog/cashier-product-details.js', source => source
  .replace("const { getMissingProductInformation } = require('./product-information');", '')
  .replace('const defaults = getMissingProductInformation(product);', 'const defaults = {};')
  .replace("['Descrição', isGenericDescription ? defaults.descriptionAi : savedDescription]", "['Descrição', isGenericDescription ? '' : savedDescription]"));
edit('src/catalog/product-import.js', source => source
  .replace("const { resolveHdProductImage, isKgProduct } = require('./image-resolver');", "const { isKgProduct } = require('./image-resolver');")
  .replace("const { getProductCareDetails } = require('./product-care');\r\n", '').replace("const { getProductCareDetails } = require('./product-care');\n", '')
  .replace("const { buildProductInformation } = require('./product-information');\r\n", '').replace("const { buildProductInformation } = require('./product-information');\n", '')
  .replace("(row.status === 'INATIVO' ? '0' : '50')", "'0'")
  .replace(/      const hdPhoto =[^\n]+\r?\n      const care =[^\n]+\r?\n      const info =[^\n]+\r?\n      const desc =[^\n]+/, '')
  .replace(/images: hdPhoto \? \[hdPhoto\] : \[\]/, 'images: []').replace(/hdPhoto \|\| ''/g, "''")
  .replace(/care\.[a-z_]+ \|\| info\.[a-z_]+ \|\| ''|care\.[a-z_]+ \|\| ''|info\.[a-z_]+ \|\| ''/g, "''")
  .replace(/descriptionAi: desc,/, "descriptionAi: '',").replace(/descricao_ia: desc,/, "descricao_ia: '',"));
edit('src/catalog/product-photo.service.js', source => source
  .replace(/  const name = product.name[^]*?return `\$\{name\} selecionado\(a\)[^]*?;\r?\n}/, "  return typeof product.description === 'string' ? product.description.trim() : '';\n}")
  .replace("  const finalBase64 = base64Data || createConfloraSvgFallback(productName, product.category || product.categoria);", "  if (!base64Data) throw new Error('Envie uma foto real do produto.');\n  const finalBase64 = base64Data;")
  .replace("const finalContentType = base64Data ? contentType : 'image/svg+xml';", 'const finalContentType = contentType;'));
edit('src/storefront/existing-store.js', source => source
  .replace('conflora.example.json', 'conflora.json')
  .replace('process.env.OWNER_WHATSAPP_NUMBER || profile.checkout?.contactPhone || "5564999351616"', 'process.env.OWNER_WHATSAPP_NUMBER || ""')
  .replace('    result.checkout.enabledPayments = ["PIX", "CASH", "CREDITO", "DEBITO"];', '')
  .replace('    result.checkout ||= structuredClone(profile.checkout);', '    result.checkout ||= structuredClone(profile.checkout);\n    result.categories ||= [];')
  .replace('process.env.STORE_NOTIFICATION_PHONE || process.env.OWNER_WHATSAPP_NUMBER || "5564999351616"', 'process.env.STORE_NOTIFICATION_PHONE || process.env.OWNER_WHATSAPP_NUMBER || ""')
  .replace('  config.checkout.enabledPayments = ["PIX", "CASH", "CREDITO", "DEBITO"];', '  config.checkout.enabledPayments = [];\n  config.checkout.pickup.enabled = false;')
  .replace('    enabled: true,\r\n    label: "Entrega",\r\n    serviceAreas: ["Mineiros - GO"],', '    enabled: false,\r\n    label: "Entrega",\r\n    serviceAreas: [],')
  .replace('    enabled: true,\n    label: "Entrega",\n    serviceAreas: ["Mineiros - GO"],', '    enabled: false,\n    label: "Entrega",\n    serviceAreas: [],'));
edit('src/http/views-admin.js', source => source.replace(/    async function seedDefaultConflora\(\)[^]*?\r?\n    \/\/ INICIALIZAÇÃO/, '    // INICIALIZAÇÃO')
  .replace(/\s*localStorage.setItem\('conflora_(?:user|op)', JSON.stringify\(currentUser\)\);/g, ''));
edit('src/agent/product-search.js', source => source.replace('ttlMs = 5 * 60_000, minRefreshGapMs = 15_000', 'ttlMs = 0, minRefreshGapMs = 0'));
edit('public/storefront/stock-counting.js', source => source.replace(/  function persist\(\) \{[^]*?\r?\n  }/, '  function persist() { /* Unsaved edits live only in this screen. */ }')
  .replace(/    try \{\r?\n      const saved = JSON.parse\(window.sessionStorage[^]*?\r?\n    } catch \{[^\n]+/, "    try { window.sessionStorage.removeItem(key()); } catch { /* Storage is optional. */ }"));
edit('package.json', source => { const data = JSON.parse(source); delete data.scripts['seed:dev']; return JSON.stringify(data, null, 2) + '\n'; });
fs.renameSync('config/stores/conflora.example.json', 'config/stores/conflora.json');
for (const file of ['src/catalog/product-care.js', 'src/catalog/product-information.js', 'scripts/enrich-firestore-catalog.js',
  'scripts/seed-dev.js', 'scripts/reset-and-seed-real-catalog.js', 'public/reports/fechamento-caixa-2026-10-18.pdf']) {
  fs.rmSync(file, { force: true });
}
