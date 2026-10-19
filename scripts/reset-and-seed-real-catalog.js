#!/usr/bin/env node
/**
 * Script de Reset Completo de Histórico/Credenciais + Importação Real da Planilha LISTA DE PRODUTOS.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { Firestore } = require('@google-cloud/firestore');
const { resolveHdProductImage, isKgProduct } = require('../src/catalog/image-resolver');
const { generateStandardTags, generateStandardDescription } = require('../src/catalog/product-photo.service');
const { protectCredentials } = require('../src/security/credentials');

const XLSX_PATH = process.env.PRODUCTS_XLSX_PATH || 'C:/Users/Junin/.gemini/antigravity/brain/540fc688-80a5-4954-b08e-bcd05b9b8033/.user_uploaded/media_1792379391304_179b463b.xlsx';

function readZipCentral(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const cdCount = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < cdCount; i++) {
    const method = buf.readUInt16LE(cdOffset + 10);
    const compSize = buf.readUInt32LE(cdOffset + 20);
    const nameLen = buf.readUInt16LE(cdOffset + 28);
    const extraLen = buf.readUInt16LE(cdOffset + 30);
    const commentLen = buf.readUInt16LE(cdOffset + 32);
    const localOffset = buf.readUInt32LE(cdOffset + 42);
    const name = buf.slice(cdOffset + 46, cdOffset + 46 + nameLen).toString('utf8');
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const compData = buf.slice(dataStart, dataStart + compSize);
    files[name] = method === 8 ? zlib.inflateRawSync(compData) : compData;
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function decodeXmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode( parseInt(hex, 16)));
}

function parseSharedStrings(xml) {
  const strings = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = siRegex.exec(xml)) !== null) {
    const inner = match[1];
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tMatch;
    let combined = '';
    while ((tMatch = tRegex.exec(inner)) !== null) {
      combined += decodeXmlEntities(tMatch[1]);
    }
    strings.push(combined);
  }
  return strings;
}

function colIndexFromRef(ref) {
  const letters = (ref.match(/^[A-Z]+/) || ['A'])[0];
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64);
  }
  return idx - 1;
}

function parseSheetRows(xml, sharedStrings) {
  const rows = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rMatch;
  while ((rMatch = rowRegex.exec(xml)) !== null) {
    const rowXml = rMatch[1];
    const rowCells = [];
    const cRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cMatch;
    while ((cMatch = cRegex.exec(rowXml)) !== null) {
      const attrs = cMatch[1];
      const cellInner = cMatch[2];
      const rAttr = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1] || 'A1';
      const tAttr = (attrs.match(/\bt="([^"]+)"/) || [])[1] || '';
      const colIdx = colIndexFromRef(rAttr);
      let val = '';
      if (tAttr === 's') {
        const vMatch = cellInner.match(/<v>([\s\S]*?)<\/v>/);
        const sIdx = vMatch ? Number(vMatch[1]) : -1;
        val = sIdx >= 0 && sIdx < sharedStrings.length ? sharedStrings[sIdx] : '';
      } else if (tAttr === 'inlineStr') {
        const tMatch = cellInner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
        val = tMatch ? decodeXmlEntities(tMatch[1]) : '';
      } else {
        const vMatch = cellInner.match(/<v>([\s\S]*?)<\/v>/);
        val = vMatch ? decodeXmlEntities(vMatch[1]) : '';
      }
      rowCells[colIdx] = String(val).trim();
    }
    if (rowCells.some((c) => c && c.length > 0)) {
      rows.push(rowCells);
    }
  }
  return rows;
}

function parsePrice(rawVal) {
  if (rawVal === undefined || rawVal === null || rawVal === '') return 0;
  const cleaned = String(rawVal)
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  const num = Number(cleaned);
  return Number.isFinite(num) && num >= 0 ? Number(num.toFixed(2)) : 0;
}

function extractProductsFromXlsx(xlsxPath) {
  const buf = fs.readFileSync(xlsxPath);
  const files = readZipCentral(buf);
  const sharedStrings = parseSharedStrings(files['xl/sharedStrings.xml']?.toString('utf8') || '');
  const productsMap = new Map();

  for (const sheetName of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet3.xml', 'xl/worksheets/sheet4.xml']) {
    const xml = files[sheetName]?.toString('utf8');
    if (!xml) continue;
    const rows = parseSheetRows(xml, sharedStrings);
    if (rows.length < 2) continue;

    // Header: Product ID, DESCRIÇÃO, STATUS, VALOR, CATEGORIA, SUBCATEGORIA
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const id = String(row[0] || '').trim();
      const name = String(row[1] || '').trim();
      if (!id || !name || id.toLowerCase() === 'product id') continue;

      const rawStatus = String(row[2] || 'ATIVO').trim().toUpperCase();
      const status = rawStatus === 'INATIVO' ? 'INATIVO' : 'ATIVO';
      const price = parsePrice(row[3]);
      const category = String(row[4] || 'Plantas / Mudas').trim();
      const subcategory = String(row[5] || '').trim();

      productsMap.set(id, {
        id,
        name,
        status,
        price,
        category,
        subcategory,
      });
    }
  }

  return Array.from(productsMap.values());
}

async function deleteCollection(firestore, collectionName) {
  const snap = await firestore.collection(collectionName).get();
  if (snap.empty) return 0;
  let deleted = 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = firestore.batch();
    const chunk = docs.slice(i, i + 400);
    for (const doc of chunk) {
      batch.delete(doc.ref);
      deleted++;
    }
    await batch.commit();
  }
  return deleted;
}

async function main() {
  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'confloraai';
  const firestore = new Firestore({ projectId, ignoreUndefinedProperties: true });

  console.log(`Conectado ao Firestore [${projectId}]. Lendo planilha: ${XLSX_PATH}`);
  const extractedProducts = extractProductsFromXlsx(XLSX_PATH);
  console.log(`Produtos extraídos da planilha LISTA DE PRODUTOS: ${extractedProducts.length}`);

  const collectionsToWipe = [
    'orders',
    'customers',
    'customer_debts',
    'debt_settlements',
    'cashier_closings',
    'notifications',
    'pdv_outbox',
    'processed_messages',
    'stock_movements',
    'storefront_events',
    'application_errors',
    'request_limits',
    'web_sessions',
    'sessions',
    'users',
    'user_emails',
    'customer_emails',
    'products',
    'product_images',
    'catalog_archives',
    'delivery_driver_metrics',
    'order_alterations',
    'discount_approvals',
  ];

  console.log('Zerando todo o histórico, sessões, credenciais e produtos antigos...');
  for (const col of collectionsToWipe) {
    const count = await deleteCollection(firestore, col);
    if (count > 0) {
      console.log(`  - ${col}: ${count} documento(s) removido(s)`);
    }
  }

  // Semeia contas limpas de acesso (Edmar sem senha fixa para poder criar a sua no primeiro login/cadastro, + PIN 1234)
  const now = new Date().toISOString();

  const initialUsers = await Promise.all([
    protectCredentials({
      id: 'usr-edmar',
      name: 'Edmar Júnio',
      email: 'edmarjuniob@gmail.com',
      role: 'ADMIN',
      active: true,
      pin: '1234',
      authProvider: 'GOOGLE_OR_PASSWORD',
      createdAt: now,
      updatedAt: now,
    }),
    protectCredentials({
      id: 'usr-caixa1',
      name: 'Operador de Caixa',
      email: 'caixa@conflora.com.br',
      role: 'CAIXA',
      active: true,
      pin: '1111',
      authProvider: 'PIN',
      createdAt: now,
      updatedAt: now,
    }),
    protectCredentials({
      id: 'usr-vendedor1',
      name: 'Vendedor Conflora',
      email: 'vendedor@conflora.com.br',
      role: 'VENDEDOR',
      active: true,
      pin: '2222',
      authProvider: 'PIN',
      createdAt: now,
      updatedAt: now,
    }),
    protectCredentials({
      id: 'usr-entregador1',
      name: 'Entregador Conflora',
      email: 'entregador@conflora.com.br',
      role: 'ENTREGADOR',
      active: true,
      pin: '3333',
      authProvider: 'PIN',
      createdAt: now,
      updatedAt: now,
    }),
  ]);

  const userBatch = firestore.batch();
  for (const u of initialUsers) {
    userBatch.set(firestore.collection('users').doc(u.id), u);
    if (u.email) {
      userBatch.set(firestore.collection('user_emails').doc(u.email), {
        userId: u.id,
        email: u.email,
        updatedAt: now,
      });
    }
  }
  await userBatch.commit();
  console.log('Credenciais resetadas e perfis base recriados.');

  // Importa os produtos da planilha com fotos temáticas em HD
  console.log('Importando produtos da LISTA DE PRODUTOS com fotos temáticas HD...');
  for (let i = 0; i < extractedProducts.length; i += 350) {
    const batch = firestore.batch();
    const chunk = extractedProducts.slice(i, i + 350);
    for (const item of chunk) {
      const unit = isKgProduct(item.name, '') ? 'KG' : 'UN';
      const hdPhotoUrl = resolveHdProductImage(item.name, item.category, item.subcategory);
      const baseDoc = {
        id: item.id,
        name: item.name,
        canonicalName: item.name,
        descricao: item.name,
        'DESCRIÇÃO': item.name,
        status: item.status,
        STATUS: item.status,
        price: item.price,
        valor_num: item.price,
        VALOR: item.price,
        category: item.category,
        categoria: item.category,
        CATEGORIA: item.category,
        subcategory: item.subcategory,
        subcategoria: item.subcategory,
        SUBCATEGORIA: item.subcategory,
        unit,
        unidade: unit,
        saleUnit: {
          code: unit,
          label: unit === 'KG' ? 'kg' : 'unidade',
          minimum: unit === 'KG' ? 0.1 : 1,
          increment: unit === 'KG' ? 0.1 : 1,
        },
        stockQuantity: 50,
        estoque: 50,
        reservedQuantity: 0,
        imageUrl: hdPhotoUrl,
        imagePathCache: hdPhotoUrl,
        images: [hdPhotoUrl],
        createdAt: now,
        updatedAt: now,
      };
      const { tagsString } = generateStandardTags(baseDoc);
      const desc = generateStandardDescription(baseDoc);
      baseDoc.tagsAi = tagsString;
      baseDoc.tags_ia = tagsString;
      baseDoc.descriptionAi = desc;
      baseDoc.descricao_ia = desc;

      batch.set(firestore.collection('products').doc(String(item.id)), baseDoc);
    }
    await batch.commit();
  }

  const activeCount = extractedProducts.filter((p) => p.status === 'ATIVO').length;
  const inactiveCount = extractedProducts.length - activeCount;
  console.log(`Importação concluída com sucesso! Total: ${extractedProducts.length} (${activeCount} ATIVOS, ${inactiveCount} INATIVOS).`);
}

main().catch((err) => {
  console.error('Erro ao executar reset e importação:', err);
  process.exit(1);
});
