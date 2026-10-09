const ExcelJS = require("exceljs");
const { auditProductRecords } = require("../database/firestore.repository");

async function readProductWorkbook(buffer) {
  if (!buffer.length) {
    throw new Error("Selecione um arquivo Excel .xlsx.");
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets.find(
    (s) => s.name.trim().toUpperCase() === "PRODUTOS",
  );
  if (!sheet) {
    throw new Error("A planilha precisa conter a aba PRODUTOS.");
  }
  if (sheet.rowCount > 10001 || sheet.columnCount > 50) {
    throw new Error("Limite: 10.000 produtos e 50 colunas.");
  }
  const value = (cell) => {
    const v = cell.value;
    if (v && typeof v === "object") {
      if ("formula" in v || "sharedFormula" in v) {
        return v.result ?? "";
      }
      if (v.richText) {
        return v.richText.map((part) => part.text).join("");
      }
      if (v.text) {
        return v.text;
      }
      throw new Error("Célula inválida: " + cell.address);
    }
    return v ?? "";
  };
  const headers = sheet
    .getRow(1)
    .values.slice(1)
    .map((v) => String(v || "").trim());
  for (const key of [
    "Product ID",
    "DESCRIÇÃO",
    "STATUS",
    "VALOR",
    "CATEGORIA",
    "SUBCATEGORIA",
  ]) {
    if (!headers.includes(key)) {
      throw new Error("Coluna obrigatória ausente: " + key);
    }
  }
  if (
    new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length
  ) {
    throw new Error("Existem colunas duplicadas.");
  }
  const records = [];
  sheet.eachRow((row, line) => {
    if (line === 1) {
      return;
    }
    const record = { _line: line };
    headers.forEach((h, index) => {
      if (h) {
        record[h] = value(row.getCell(index + 1));
      }
    });
    if (Object.entries(record).some(([k, v]) => k !== "_line" && v !== "")) {
      records.push(record);
    }
  });
  return {
    sheet: sheet.name,
    ignoredSheets: workbook.worksheets
      .filter((s) => s !== sheet)
      .map((s) => s.name),
    records,
    ...auditProductRecords(records),
  };
}

module.exports = { readProductWorkbook };
