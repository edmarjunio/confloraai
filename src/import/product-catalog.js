const { t } = require("../i18n");
const { randomUUID } = require("node:crypto");
const { readProductsXlsx } = require("./products-xlsx");
const { fail } = require("../operations/ledger");
async function catalogState(db, tx = null) {
  const ref = db.collection("catalog_settings").doc("current");
  const snap = tx ? await tx.get(ref) : await ref.get();
  return snap.exists
    ? snap.data()
    : { revision: "legacy", collectionPath: "products" };
}
async function previewProducts(db, buffer) {
  const audit = await readProductsXlsx(buffer);
  const state = await catalogState(db);
  return { ...audit, expectedRevision: state.revision };
}
async function replaceProducts(repo, buffer, expectedRevision, actor) {
  const db = repo.firestore;
  const audit = await previewProducts(db, buffer);
  if (audit.errors.length) {
    fail(audit.errors.join("\n"));
  }
  if (audit.expectedRevision !== expectedRevision) {
    fail(t("interface.message.d9d067b01a31"), 409);
  }
  const old = await repo.getAllProducts();
  const previous = new Map(old.map((p) => [p.id, p]));
  const revision = randomUUID();
  const collectionPath = "catalog_imports/" + revision + "/products";
  const products = audit.products.map((p) => {
    const existing = previous.get(p.id) || {};
    return {
      ...existing,
      ...p,
      stockQuantity: Number(existing.stockQuantity ?? existing.estoque ?? 0),
      estoque: Number(existing.stockQuantity ?? existing.estoque ?? 0),
      stockVersion: Number(existing.stockVersion || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
  });
  for (let offset = 0; offset < products.length; offset += 200) {
    const batch = db.batch();
    products
      .slice(offset, offset + 200)
      .forEach((p) => batch.set(db.collection(collectionPath).doc(p.id), p));
    await batch.commit();
  }
  const staged = await db.collection(collectionPath).get();
  if (staged.docs.length !== products.length) {
    fail(t("interface.message.249dd6789042"));
  }
  await db.runTransaction(async (tx) => {
    const current = await catalogState(db, tx);
    if (current.revision !== expectedRevision) {
      fail(t("interface.message.1a03b6a35ce3"), 409);
    }
    const snapshots = await tx.getAll(
      ...old.map((p) => db.collection(current.collectionPath).doc(p.id)),
    );
    for (let i = 0; i < old.length; i++) {
      const fresh = snapshots[i].data() || {};
      if (
        Number(fresh.stockVersion || 0) !== Number(old[i].stockVersion || 0) ||
        Number(fresh.stockQuantity ?? fresh.estoque ?? 0) !==
          Number(old[i].stockQuantity ?? old[i].estoque ?? 0)
      ) {
        fail(t("catalog.inventoryChanged"), 409);
      }
    }
    tx.set(db.collection("catalog_settings").doc("current"), {
      revision,
      collectionPath,
      fileHash: audit.fileHash,
      productCount: products.length,
      importedBy: actor.id,
      importedAt: new Date().toISOString(),
      previousCollectionPath: current.collectionPath,
    });
  });
  repo.inMemoryProducts.clear();
  products.forEach((p) => repo.inMemoryProducts.set(p.id, p));
  return { count: products.length, revision, previousCount: old.length };
}
module.exports = { catalogState, previewProducts, replaceProducts };
