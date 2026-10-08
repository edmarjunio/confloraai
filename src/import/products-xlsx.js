const { t } = require("../i18n");
const ExcelJS = require("exceljs");
const { createHash } = require("node:crypto");
const { inflateRawSync } = require("node:zlib");
const { auditProductRecords } = require("../database/firestore.repository");

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_PRODUCTS = 10000;
const REQUIRED_HEADERS = [
  "Product ID",
  "DESCRIÇÃO",
  "STATUS",
  "VALOR",
  "CATEGORIA",
  "SUBCATEGORIA",
];

function importError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

// XLSX é um ZIP. Verifica o tamanho real antes de o ExcelJS alocar as células.
// Não extrai arquivos no disco, não acessa links e não executa fórmulas/macros.
function checkArchive(buffer) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 22 ||
    buffer.length > MAX_FILE_BYTES
  ) {
    throw importError(t("interface.message.ab58592e64e5"));
  }
  let end = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i--
  ) {
    if (
      buffer.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + buffer.readUInt16LE(i + 20) === buffer.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) {
    throw importError(t("interface.message.66e9eab3302a"));
  }
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  let totalBytes = 0;
  const names = new Set();
  if (
    count > 1000 ||
    offset >= end ||
    buffer.readUInt32LE(end + 12) > end - offset
  ) {
    throw importError(t("interface.message.a3b0b701e27b"));
  }
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw importError("Arquivo Excel corrompido.");
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressed = buffer.readUInt32LE(offset + 20);
    const expanded = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const local = buffer.readUInt32LE(offset + 42);
    const next =
      offset +
      46 +
      nameLength +
      buffer.readUInt16LE(offset + 30) +
      buffer.readUInt16LE(offset + 32);
    if (
      next > end ||
      local + 30 > buffer.length ||
      buffer.readUInt32LE(local) !== 0x04034b50
    ) {
      throw importError("Arquivo Excel corrompido.");
    }
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (
      names.has(name) ||
      name.includes("..") ||
      name.startsWith("/") ||
      name.includes("\\") ||
      flags & 1 ||
      ![0, 8].includes(method)
    ) {
      throw importError(t("interface.message.c2daa26dfa2e"));
    }
    names.add(name);
    totalBytes += expanded;
    if (expanded > 16 * 1024 * 1024 || totalBytes > 64 * 1024 * 1024) {
      throw importError(t("interface.message.1304a7e9f03f"));
    }
    const start =
      local +
      30 +
      buffer.readUInt16LE(local + 26) +
      buffer.readUInt16LE(local + 28);
    if (start + compressed > offset || start + compressed > buffer.length) {
      throw importError("Arquivo Excel corrompido.");
    }
    let content;
    try {
      content =
        method === 0
          ? buffer.subarray(start, start + compressed)
          : inflateRawSync(buffer.subarray(start, start + compressed), {
              maxOutputLength: Math.max(expanded, 1),
            });
    } catch {
      throw importError(t("interface.message.de70085a36a9"));
    }
    if (content.length !== expanded) {
      throw importError(t("interface.message.08a907a89a9d"));
    }
    if (name.endsWith(".xml")) {
      const xml = content.toString("utf8");
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
        throw importError(t("interface.message.fdfd2cda91ed"));
      }
      if (/^xl\/worksheets\//.test(name)) {
        for (const match of xml.matchAll(
          /<(?:[\w]+:)?row\b[^>]*\br=["'](\d+)["']/g,
        )) {
          if (Number(match[1]) > MAX_PRODUCTS + 1) {
            throw importError(t("interface.message.1a2bbc1b0ca0"));
          }
        }
      }
    }
    offset = next;
  }
  if (!names.has("xl/workbook.xml") || !names.has("[Content_Types].xml")) {
    throw importError(t("interface.message.f094117ecd06"));
  }
}

function cellValue(cell) {
  const value = cell.value;
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (value.richText) {
    return value.richText.map((part) => part.text).join("");
  }
  if (value.hyperlink) {
    return value.text || "";
  }
  if (value.formula || value.sharedFormula) {
    throw importError(
      t("interface.text.c6b1f4d8ad56") +
        cell.address +
        t("interface.text.b5c392689298"),
    );
  }
  throw importError(
    t("interface.text.c6b1f4d8ad56") +
      cell.address +
      t("interface.text.e5d141ea7ffa"),
  );
}

function headerKey(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

async function readProductsXlsx(buffer) {
  checkArchive(buffer);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw importError(t("interface.message.de4a3751b6fd"));
  }
  const sheet =
    workbook.worksheets.find(
      (item) => item.name.trim().toUpperCase() === "PRODUTOS",
    ) || (workbook.worksheets.length === 1 ? workbook.worksheets[0] : null);
  if (!sheet) {
    throw importError(t("interface.message.b88b854bbb7d"));
  }
  if (sheet.columnCount > 32 || sheet.rowCount > MAX_PRODUCTS + 1) {
    throw importError(t("interface.message.da24a0b36163"));
  }
  const headers = [];
  const seen = new Set();
  sheet.getRow(1).eachCell((cell, column) => {
    const header = String(cellValue(cell)).trim();
    const key = headerKey(header);
    if (
      !key ||
      seen.has(key) ||
      ["proto", "constructor", "prototype", "line"].includes(key)
    ) {
      throw importError(t("interface.text.eabec458d2f7") + column + ".");
    }
    seen.add(key);
    headers[column] = header;
  });
  const missing = REQUIRED_HEADERS.filter(
    (header) => !seen.has(headerKey(header)),
  );
  if (missing.length) {
    throw importError(
      t("interface.text.261a7f79e6aa") + missing.join(", ") + ".",
    );
  }
  const records = [];
  sheet.eachRow((row, line) => {
    if (line === 1) {
      return;
    }
    const record = { _line: line };
    let hasValue = false;
    row.eachCell((cell) => {
      if (
        cell.value !== null &&
        cell.value !== undefined &&
        !headers[cell.col]
      ) {
        throw importError("Linha " + line + t("interface.text.d264abcf44c6"));
      }
    });
    headers.forEach((header, column) => {
      const value = cellValue(row.getCell(column));
      record[header] = value;
      if (String(value).trim() !== "") {
        hasValue = true;
      }
    });
    if (hasValue) {
      records.push(record);
    }
  });
  const audit = auditProductRecords(records);
  const activeCount = audit.products.filter(
    (item) => item.status === "ATIVO",
  ).length;
  const categories = Object.create(null);
  for (const product of audit.products) {
    categories[product.category] = (categories[product.category] || 0) + 1;
  }
  return {
    ...audit,
    records,
    fileHash: createHash("sha256").update(buffer).digest("hex"),
    sheetName: sheet.name,
    summary: {
      total: records.length,
      active: activeCount,
      inactive: audit.products.length - activeCount,
      categories,
      headers: headers.filter(Boolean),
    },
  };
}

module.exports = { readProductsXlsx, MAX_FILE_BYTES, importError };
