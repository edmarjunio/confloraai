const { createHash } = require('node:crypto');
const { PdvRepository } = require('../orders/pdv.repository');
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const columns = { codigo: 'sku', sku: 'sku', nome: 'name', produto: 'name', descricao: 'name', preco: 'price', valor: 'price', categoria: 'category', subcategoria: 'subcategory', unidade: 'unit', estoque: 'stock', status: 'status' };
const invalid = message => Object.assign(new Error(message), { status: 400 });

function parseCsv(input) {
  if (typeof input !== 'string' || Buffer.byteLength(input) > 1024 * 1024) throw invalid('Envie CSV UTF-8 de até 1 MB.');
  const text = input.replace(/^\uFEFF/, '');
  if (text.includes('\uFFFD')) throw invalid('Salve a planilha como CSV UTF-8.');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const rows = []; let row = []; let value = ''; let quoted = false; let closed = false;
  for (let i = 0; i <= text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else if (char === undefined) throw invalid('Aspas não fechadas no CSV.');
      else value += char;
      continue;
    }
    if (char === '"') { if (value || closed) throw invalid('Aspas inválidas no CSV.'); quoted = true; }
    else if (char === delimiter || char === '\n' || char === '\r' || char === undefined) {
      row.push(value.trim()); value = ''; closed = false;
      if (char !== delimiter) {
        if (row.some(Boolean)) rows.push(row);
        if (rows.length > 2001) throw invalid('Limite de 2.000 produtos por arquivo.');
        row = []; if (char === '\r' && text[i + 1] === '\n') i++;
      }
    } else { if (closed && char.trim()) throw invalid('Conteúdo após aspas no CSV.'); if (!closed) value += char; }
    if (value.length > 1000) throw invalid('Campo muito longo no CSV.');
  }
  if (rows.length < 2) throw invalid('Inclua o cabeçalho e pelo menos um produto.');
  return rows;
}

function decimal(value, precision, field) {
  const text = String(value).trim().replace(/^R\$\s*/, '');
  const pattern = precision ? new RegExp('^\\d+(?:[.,]\\d{1,' + precision + '})?$') : /^\d+$/;
  if (!pattern.test(text)) throw invalid(`${field}: use número sem separador de milhar, com até ${precision} casas decimais.`);
  const number = Number(text.replace(',', '.'));
  if (!Number.isFinite(number) || number > 10000000) throw invalid(`${field}: valor fora do limite.`);
  return number;
}

function parseProductList(input) {
  if (!Array.isArray(input) || !input.length || input.length > 2000 || Buffer.byteLength(JSON.stringify(input)) > 1024 * 1024) throw invalid('Envie uma lista JSON de 1 a 2.000 produtos, até 1 MB.');
  const headers = ['sku', 'nome', 'preco', 'categoria', 'subcategoria', 'unidade', 'estoque', 'status'];
  const rows = input.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid('Cada produto JSON deve ser um objeto.');
    const values = [item.sku ?? item.codigo, item.name ?? item.nome, item.price ?? item.preco, item.category ?? item.categoria, item.subcategory ?? item.subcategoria ?? '', item.unit ?? item.unidade, item.stock ?? item.estoque, item.status ?? (item.active === false ? 'INATIVO' : 'ATIVO')];
    if (values.some(value => !['string', 'number'].includes(typeof value) || String(value).length > 1000)) throw invalid('Campos JSON ausentes ou inválidos. Use sku, name, price, category, unit e stock.');
    return values.map(value => String(value).trim());
  });
  return [headers, ...rows];
}

function prepareImport(csv) {
  const table = Array.isArray(csv) ? parseProductList(csv) : parseCsv(csv); const headers = table.shift().map(header => columns[normalize(header)]);
  if (headers.some(header => !header) || new Set(headers).size !== headers.length) throw invalid('Cabeçalhos inválidos ou repetidos. Use o modelo disponível.');
  for (const header of ['sku', 'name', 'price', 'category', 'unit', 'stock']) if (!headers.includes(header)) throw invalid('Coluna obrigatória ausente: ' + header);
  const seen = new Set(); const errors = []; const products = [];
  table.forEach((cells, index) => {
    try {
      if (cells.length !== headers.length) throw invalid('Quantidade de colunas diferente do cabeçalho.');
      const row = Object.fromEntries(headers.map((header, position) => [header, cells[position]]));
      if (!/^[\p{L}\p{N}._-]{1,64}$/u.test(row.sku)) throw invalid('Código obrigatório: até 64 letras, números, ponto, traço ou sublinhado.');
      const key = normalize(row.sku);
      if (seen.has(key)) throw invalid('Código repetido no arquivo.'); seen.add(key);
      if (!row.name || row.name.length > 180 || !row.category || row.category.length > 80) throw invalid('Informe nome e categoria válidos.');
      const unit = normalize(row.unit).toUpperCase();
      if (!['UN', 'KG'].includes(unit)) throw invalid('Unidade deve ser UN ou KG.');
      const price = decimal(row.price, 2, 'Preço');
      if (price <= 0) throw invalid('Preço deve ser maior que zero.');
      const stock = decimal(row.stock, unit === 'KG' ? 3 : 0, 'Estoque');
      const status = (row.status || 'ATIVO').toUpperCase();
      if (!['ATIVO', 'INATIVO'].includes(status)) throw invalid('Status deve ser ATIVO ou INATIVO.');
      const id = 'prd-' + createHash('sha256').update(key).digest('hex').slice(0, 32);
      products.push({ id, sku: row.sku, name: row.name, canonicalName: row.name, descricao: row.name, price, valor_num: price, category: row.category, subcategory: String(row.subcategory || '').slice(0, 80), unit, unidade: unit, saleUnit: { code: unit, label: unit === 'KG' ? 'kg' : 'unidade', minimum: unit === 'KG' ? 0.1 : 1, increment: unit === 'KG' ? 0.1 : 1 }, stockQuantity: stock, estoque: stock, reservedQuantity: 0, status, STATUS: status, images: [], imageUrl: '', source: 'CSV_IMPORT' });
    } catch (error) { if (errors.length < 100) errors.push({ line: index + 2, error: error.message }); }
  });
  const importId = createHash('sha256').update(JSON.stringify(products)).digest('hex');
  return { importId, products, errors, total: table.length };
}

class ProductImportService {
  constructor(repository) { this.repository = repository; this.store = new PdvRepository(repository); }
  async preview(csv) {
    const plan = prepareImport(csv);
    const existing = this.repository.firestore ? (await this.repository.firestore.collection('products').get()).docs.map(doc => ({ ...doc.data(), id: doc.id })) : await this.repository.getAllProducts();
    const bySku = new Map(existing.map(product => [normalize(product.sku || product.codigo || product.id), product]));
    const byId = new Map(existing.map(product => [product.id, product]));
    for (const product of plan.products) {
      const current = bySku.get(normalize(product.sku)) || byId.get(product.id);
      if (current && current.importId !== plan.importId) plan.errors.push({ code: product.sku, error: 'Código já cadastrado. Edite o produto no sistema; a importação não substitui estoque existente.' });
    }
    return plan;
  }
  async commit(csv, expectedId, user) {
    const plan = await this.preview(csv);
    if (plan.importId !== expectedId) throw invalid('O arquivo mudou. Gere a prévia novamente.');
    if (plan.errors.length) throw invalid('Corrija os erros da prévia antes de importar.');
    for (let offset = 0; offset < plan.products.length; offset += 200) {
      const batch = plan.products.slice(offset, offset + 200);
      await this.store.transaction(async tx => {
        const job = await tx.get('product_imports', plan.importId);
        if (Number(job?.processed || 0) > offset) return;
        const previous = await Promise.all(batch.map(product => tx.get('products', product.id)));
        if (previous.some(product => product && product.importId !== plan.importId)) throw invalid('Cadastro alterado durante importação. Atualize a prévia.');
        const now = new Date().toISOString();
        batch.forEach((product, index) => { if (!previous[index]) tx.set('products', product.id, { ...product, importId: plan.importId, createdAt: now, updatedAt: now }); });
        tx.set('product_imports', plan.importId, { id: plan.importId, processed: offset + batch.length, total: plan.total, status: offset + batch.length === plan.total ? 'COMPLETED' : 'PROCESSING', importedBy: user.id, updatedAt: now });
      });
    }
    return { success: true, importId: plan.importId, imported: plan.products.length };
  }
}
const CSV_TEMPLATE = '\uFEFFcodigo;nome;preco;categoria;subcategoria;unidade;estoque;status\r\n';
module.exports = { ProductImportService, prepareImport, parseCsv, parseProductList, CSV_TEMPLATE };
