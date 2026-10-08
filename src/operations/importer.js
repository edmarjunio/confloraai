const { t } = require("../i18n");
const { hash, fail } = require("./ledger");
function text(v) {
  return String(v ?? "").trim();
}
function normalize(v) {
  return text(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}
function value(cell) {
  const v = cell.value;
  if (v instanceof Date) {
    return v.toISOString();
  }
  if (v && typeof v === "object") {
    return v.result ?? v.text ?? cell.text;
  }
  return v ?? null;
}
async function prepare(
  buffer,
  products,
  mapping = {},
  mode = "salesAndEntries",
) {
  const ExcelJS = require("exceljs");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const digest = hash(buffer);
  const records = [];
  const errors = [];
  const warnings = [];
  const unresolved = [];
  if (!["sales", "entries", "salesAndEntries"].includes(mode)) {
    fail(t("interface.message.660dcd31e79b"));
  }
  const sheets =
    mode === "sales"
      ? ["VENDAS HORTA"]
      : mode === "entries"
        ? ["ITENS"]
        : ["VENDAS HORTA", "ITENS"];
  for (const sheetName of sheets) {
    const sheet = book.getWorksheet(sheetName);
    if (!sheet) {
      fail(t("interface.text.1f1d4b6be617") + sheetName);
    }
    const headers = sheet.getRow(1).values.slice(1);
    sheet.eachRow((row, line) => {
      if (line === 1) {
        return;
      }
      const raw = Object.fromEntries(
        headers.map((h, i) => [h, value(row.getCell(i + 1))]),
      );
      const id = hash(`${digest}:${sheetName}:${line}`);
      const provenance = {
        importId: digest,
        sourceSheet: sheetName,
        sourceLine: line,
        raw,
      };
      if (sheetName === "VENDAS HORTA") {
        const category = normalize(raw.CATEGORIA),
          status = normalize(raw.Status);
        const collection =
          category.includes(t("interface.message.d0878c96c643")) ||
          status.includes(t("interface.message.d0878c96c643"))
            ? "cash_movements"
            : category.includes("RECEB")
              ? "historical_receipts"
              : "orders";
        const total = Number(raw.Valor ?? 0),
          discount = Number(raw.Desconto ?? 0);
        if (!Number.isFinite(total) || !Number.isFinite(discount)) {
          errors.push(
            `${t("interface.message.01be3d2c6020")}${line}${t("interface.message.7fd93ca8bb6b")}`,
          );
        }
        if (discount < 0) {
          warnings.push(
            `${t("interface.message.01be3d2c6020")}${line}${t("interface.message.81d1c76afcc6")}${discount}); conferir origem.`,
          );
        }
        records.push({
          collection,
          id,
          data: {
            id,
            ...provenance,
            legacyId: text(raw["Sale ID"]),
            businessDate: String(
              raw.Data || raw["Carimbo de data/hora"] || "",
            ).slice(0, 10),
            historical: true,
            stockDeducted: false,
            items: [],
            total,
            discount,
            customerName: text(raw["Nome / Razão social"]),
            customerPhone: text(raw["Número de telefone"]),
            description: text(raw.Descrição),
            paymentMethod: text(raw["Tipo de pagamento"]),
            paymentStatus: text(raw.Status),
            status: "HISTORICAL",
            createdAt: raw.Data || raw["Carimbo de data/hora"],
            actorName: text(raw.Responsável),
            receivablesReconciled: false,
          },
        });
      } else if (normalize(raw["Tipo de movimentação"]) === "ENTRADA") {
        let product = products.find(
          (p) =>
            p.id ===
            (mapping[String(line)] || text(raw["Produto Selecionado"])),
        );
        if (!product) {
          const matches = products.filter(
            (p) =>
              normalize(p.name || p.descricao) === normalize(raw.Descrição),
          );
          if (matches.length === 1) {
            product = matches[0];
          }
        }
        if (!product) {
          unresolved.push({
            line,
            name: text(raw.Descrição),
            quantity: raw.Quantidade,
          });
          errors.push(
            `ITENS linha ${line}${t("interface.message.63733ccc087e")}${text(raw.Descrição)}${t("interface.message.f8156f9bad2a")}`,
          );
        }
        const costValue = raw["Valor unitário"];
        const unitCost =
          costValue === null || costValue === undefined || costValue === ""
            ? null
            : Number(costValue);
        if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
          errors.push(
            `ITENS linha ${line}${t("interface.message.b56a97d521f5")}`,
          );
        }
        const qty = Number(raw.Quantidade);
        if (!Number.isFinite(qty) || qty <= 0) {
          errors.push(
            `ITENS linha ${line}${t("interface.message.b5905b6dcd1e")}`,
          );
        }
        records.push({
          collection: "initial_entries",
          id,
          data: {
            id,
            ...provenance,
            legacyId: text(raw["Item ID"]),
            productId: product?.id || "",
            quantity: qty,
            unitCost,
            createdAt: raw.Data,
          },
        });
      }
    });
  }
  const seen = new Set();
  let duplicateIds = 0;
  for (const r of records) {
    const k = r.collection + ":" + r.data.legacyId;
    if (r.data.legacyId && seen.has(k)) {
      duplicateIds++;
    }
    seen.add(k);
  }
  if (duplicateIds) {
    warnings.push(`${duplicateIds}${t("interface.message.910d156b3e41")}`);
  }
  return {
    importId: digest,
    unresolved,
    records,
    errors,
    warnings,
    counts: records.reduce((a, r) => {
      a[r.collection] = (a[r.collection] || 0) + 1;
      return a;
    }, {}),
  };
}
async function commit(db, preview, actor, offset = 0) {
  if (actor.role !== "ADMIN") {
    fail(t("interface.message.f17bd086e69c"), 403);
  }
  if (preview.errors.length) {
    fail(t("interface.message.2d025fd5df90"));
  }
  let imported = 0;
  // Cada linha tem marcador atômico. Reexecução retoma sem duplicar entrada ou histórico.
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > preview.records.length
  ) {
    fail(t("interface.message.aa62148f08e1"));
  }
  const slice = preview.records.slice(offset, offset + 200);
  for (const record of slice) {
    await db.runTransaction(async (tx) => {
      const state = await require("../import/product-catalog").catalogState(
        db,
        tx,
      );
      const marker = db.collection("import_rows").doc(record.id);
      if ((await tx.get(marker)).exists) {
        return;
      }
      if (record.collection === "initial_entries") {
        const ref = db
          .collection(state.collectionPath)
          .doc(record.data.productId);
        const snap = await tx.get(ref);
        if (!snap.exists) {
          fail(t("interface.text.f78af3b1f3c4") + ref.id);
        }
        const p = snap.data();
        const before = Number(p.stockQuantity ?? p.estoque ?? 0);
        const after = before + record.data.quantity;
        if (
          record.data.unitCost !== null &&
          record.data.unitCost !== undefined
        ) {
          tx.update(ref, {
            unitCost: record.data.unitCost,
            costBasis: "LAST_INFORMED_ENTRY",
            costUpdatedAt: record.data.createdAt,
          });
        }
        tx.update(ref, {
          stockQuantity: after,
          estoque: after,
          stockVersion: Number(p.stockVersion || 0) + 1,
        });
        tx.create(db.collection("stock_movements").doc(record.id), {
          ...record.data,
          type: "INITIAL_ENTRY",
          previousStock: before,
          newStock: after,
          delta: record.data.quantity,
          actorId: actor.id,
        });
      } else {
        tx.create(db.collection(record.collection).doc(record.id), record.data);
      }
      tx.create(marker, {
        importId: preview.importId,
        actorId: actor.id,
        completedAt: new Date().toISOString(),
      });
      imported++;
    });
  }
  const nextOffset = offset + slice.length;
  const complete = nextOffset === preview.records.length;
  await db
    .collection("imports")
    .doc(preview.importId)
    .set({
      counts: preview.counts,
      warnings: preview.warnings,
      actorId: actor.id,
      completedAt: complete ? new Date().toISOString() : null,
      nextOffset,
    });
  return { imported, counts: preview.counts, nextOffset, complete };
}
module.exports = { prepare, commit };
