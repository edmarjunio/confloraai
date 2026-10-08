const { t } = require("../i18n");
const { randomBytes, createHash } = require("node:crypto");
const { Ledger, fail } = require("./ledger");
const importer = require("./importer");
const { renderOperations } = require("./view");
const sessionHash = (token) => createHash("sha256").update(token).digest("hex");
function registerOperations(app, express, repo, catalogRepo = null) {
  const ledger = new Ledger(repo);
  app.get("/lancamentos", (_req, res) =>
    res.type("html").send(renderOperations()),
  );
  app.get("/fiados", (_req, res) =>
    res.type("html").send(renderOperations(true)),
  );
  app.get("/caixa", (_req, res) =>
    res.type("html").send(renderOperations(false, true)),
  );
  async function issueSession(res, user) {
    if (repo.isInMemory && !repo.firestore) {
      return;
    }
    if (!["ADMIN", "CAIXA"].includes(user.role) || user.active === false) {
      return;
    }
    const token = randomBytes(32).toString("hex");
    await ledger.db
      .collection("operator_sessions")
      .doc(sessionHash(token))
      .set({ userId: user.id, expiresAt: Date.now() + 8 * 3600000 });
    res.cookie("conflora_operator", token, {
      httpOnly: true,
      secure: !repo.isLocalTest && process.env.NODE_ENV !== "test",
      sameSite: "strict",
      maxAge: 8 * 3600000,
      path: "/",
    });
  }
  const auth = async (req, res, next) => {
    try {
      const cookie = String(req.headers.cookie || "")
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("conflora_operator="));
      const token = cookie?.slice("conflora_operator=".length);
      if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        fail(t("interface.message.216ce413bf5b"), 401);
      }
      const session = await ledger.db
        .collection("operator_sessions")
        .doc(sessionHash(token))
        .get();
      if (!session.exists || session.data().expiresAt < Date.now()) {
        fail(t("interface.message.69883ff8a543"), 401);
      }
      const user = await ledger.db
        .collection("users")
        .doc(session.data().userId)
        .get();
      if (
        !user.exists ||
        user.data().active === false ||
        !["ADMIN", "CAIXA"].includes(user.data().role)
      ) {
        fail(t("interface.message.c95202fb2826"), 403);
      }
      req.operator = {
        id: user.id,
        name: user.data().name || "",
        role: user.data().role,
      };
      if (
        req.method !== "GET" &&
        req.headers.origin &&
        req.headers.origin !== `${req.protocol}://${req.get("host")}`
      ) {
        fail(t("interface.message.d449a65c0fb6"), 403);
      }
      next();
    } catch (e) {
      res.status(e.status || 503).json({ error: e.message });
    }
  };
  const route = (fn) => async (req, res) => {
    try {
      res.json(await fn(req));
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  };
  app.use("/api/operations", auth);
  app.use("/api/admin", (req, res, next) => {
    if (["/auth/login", "/auth/users"].includes(req.path)) {
      return next();
    }
    auth(req, res, () => {
      if (
        req.method !== "GET" &&
        req.operator.role !== "ADMIN" &&
        !(req.path === "/alterations" && req.method === "POST")
      ) {
        return res.status(403).json({ error: "Acesso exclusivo de ADMIN" });
      }
      next();
    });
  });
  app.get(
    "/api/operations/state",
    route(async (req) => {
      const db = ledger.db;
      const [products, orders, alerts, notifications, creditCustomers] =
        await Promise.all([
          db.collection(await repo.getProductCollectionPath()).get(),
          db.collection("orders").orderBy("createdAt", "desc").limit(100).get(),
          db
            .collection("stock_discrepancies")
            .where("status", "==", "OPEN")
            .get(),
          db.collection("notifications").where("toRole", "==", "ADMIN").get(),
          db.collection("credit_customers").get(),
        ]);
      return {
        creditCustomers: creditCustomers.docs.map((d) => ({
          ...d.data(),
          id: d.id,
          balance: Number(d.data().balanceCents || 0) / 100,
        })),
        notifications:
          req.operator.role === "ADMIN"
            ? notifications.docs.map((d) => d.data())
            : [],
        operator: req.operator,
        products: products.docs.map((d) => ({ ...d.data(), id: d.id })),
        orders: orders.docs.map((d) => ({ ...d.data(), id: d.id })),
        discrepancies:
          req.operator.role === "ADMIN" ? alerts.docs.map((d) => d.data()) : [],
      };
    }),
  );
  for (const action of [
    "sale",
    "stock",
    "receive",
    "cancel",
    "createCreditCustomer",
    "receiveCredit",
    "cash",
  ]) {
    app.post(
      "/api/operations/" + action,
      route((req) => ledger[action](req.body, req.operator)),
    );
  }
  app.get(
    "/api/operations/cash-report",
    route((req) =>
      require("./cash-report").loadDailyReport(ledger.db, req.query.date),
    ),
  );
  app.get(
    "/api/operations/credit/:id",
    route(async (req) => {
      const id = req.params.id;
      const [customer, orders, receipts, movements] = await Promise.all([
        ledger.db.collection("credit_customers").doc(id).get(),
        ledger.db
          .collection("orders")
          .where("creditCustomerId", "==", id)
          .get(),
        ledger.db.collection("receipts").where("customerId", "==", id).get(),
        ledger.db
          .collection("credit_movements")
          .where("customerId", "==", id)
          .get(),
      ]);
      if (!customer.exists) {
        fail(t("interface.message.77f22078da1b"));
      }
      return {
        customer: {
          ...customer.data(),
          id,
          balance: Number(customer.data().balanceCents || 0) / 100,
        },
        orders: orders.docs.map((d) => ({ ...d.data(), id: d.id })),
        receipts: receipts.docs.map((d) => ({ ...d.data(), id: d.id })),
        movements: movements.docs
          .map((d) => d.data())
          .sort((a, b) =>
            String(a.createdAt).localeCompare(String(b.createdAt)),
          ),
      };
    }),
  );
  app.post(
    "/api/operations/import/preview",
    express.raw({ type: "application/octet-stream", limit: "20mb" }),
    route(async (req) => {
      if (req.operator.role !== "ADMIN") {
        fail(t("interface.message.f17bd086e69c"), 403);
      }
      const preview = await importer.prepare(
        req.body,
        await repo.getAllProducts(),
        JSON.parse(req.get("X-Product-Mapping") || "{}"),
        req.get("X-Import-Mode") || "salesAndEntries",
      );
      // File bytes are stored privately as chunks to support large imports across Cloud Run instances.
      for (let start = 0; start < req.body.length; start += 500000) {
        await ledger.db
          .collection("import_files")
          .doc(
            preview.importId +
              "-" +
              (req.get("X-Import-Mode") || "salesAndEntries"),
          )
          .collection("chunks")
          .doc(String(start).padStart(10, "0"))
          .set({ bytes: req.body.subarray(start, start + 500000) });
      }
      await ledger.db
        .collection("import_files")
        .doc(
          preview.importId +
            "-" +
            (req.get("X-Import-Mode") || "salesAndEntries"),
        )
        .set({
          actorId: req.operator.id,
          mapping: JSON.parse(req.get("X-Product-Mapping") || "{}"),
          mode: req.get("X-Import-Mode") || "salesAndEntries",
          createdAt: new Date().toISOString(),
        });
      return {
        importId:
          preview.importId +
          "-" +
          (req.get("X-Import-Mode") || "salesAndEntries"),
        counts: preview.counts,
        unresolved: preview.unresolved,
        errors: preview.errors,
        warnings: preview.warnings,
      };
    }),
  );
  app.post(
    "/api/operations/import/commit",
    route(async (req) => {
      if (req.operator.role !== "ADMIN") {
        fail(t("interface.message.f17bd086e69c"), 403);
      }
      if (
        !/^[a-f0-9]{64}-(sales|entries|salesAndEntries)$/.test(
          req.body.importId || "",
        )
      ) {
        fail(t("interface.message.236869cb418f"));
      }
      const ref = ledger.db.collection("import_files").doc(req.body.importId);
      const meta = await ref.get();
      if (!meta.exists) {
        fail(t("interface.message.213aafa3c571"));
      }
      const chunks = await ref.collection("chunks").orderBy("__name__").get();
      const preview = await importer.prepare(
        Buffer.concat(chunks.docs.map((d) => d.data().bytes)),
        await repo.getAllProducts(),
        meta.data().mapping || {},
        meta.data().mode || "salesAndEntries",
      );
      return importer.commit(
        ledger.db,
        preview,
        req.operator,
        req.body.offset || 0,
      );
    }),
  );
  app.post(
    "/api/operations/products/preview",
    express.raw({ type: "application/octet-stream", limit: "8mb" }),
    route(async (req) => {
      if (req.operator.role !== "ADMIN") {
        fail(t("interface.message.f17bd086e69c"), 403);
      }
      const audit = await require("../import/product-catalog").previewProducts(
        ledger.db,
        req.body,
      );
      const ref = ledger.db
        .collection("product_import_files")
        .doc(audit.fileHash);
      for (let start = 0; start < req.body.length; start += 500000) {
        await ref
          .collection("chunks")
          .doc(String(start).padStart(10, "0"))
          .set({ bytes: req.body.subarray(start, start + 500000) });
      }
      await ref.set({
        expectedRevision: audit.expectedRevision,
        actorId: req.operator.id,
      });
      return {
        fileHash: audit.fileHash,
        expectedRevision: audit.expectedRevision,
        summary: audit.summary,
        errors: audit.errors,
        warnings: audit.warnings,
      };
    }),
  );
  app.post(
    "/api/operations/products/replace",
    route(async (req) => {
      if (req.operator.role !== "ADMIN") {
        fail(t("interface.message.212764ff156b"), 403);
      }
      if (!/^[a-f0-9]{64}$/.test(req.body.fileHash || "")) {
        fail(t("interface.message.1cfd7fb86199"));
      }
      const ref = ledger.db
        .collection("product_import_files")
        .doc(req.body.fileHash);
      const meta = await ref.get();
      if (!meta.exists) {
        fail(t("interface.message.a8beb3a8a76f"));
      }
      const chunks = await ref.collection("chunks").orderBy("__name__").get();
      const result = await require("../import/product-catalog").replaceProducts(
        repo,
        Buffer.concat(chunks.docs.map((d) => d.data().bytes)),
        req.body.expectedRevision,
        req.operator,
      );
      if (catalogRepo) {
        catalogRepo.lastCacheTime = 0;
        await catalogRepo.refreshCatalog();
      }
      return result;
    }),
  );
  app.get(
    "/api/operations/summary",
    route(async () => {
      const snap = await ledger.db.collection("orders").get();
      const months = {};
      for (const doc of snap.docs) {
        const o = doc.data();
        if (o.status === "CANCELLED") {
          continue;
        }
        const month = String(o.createdAt || "").slice(0, 7);
        if (!month) {
          continue;
        }
        months[month] ||= { sales: 0, total: 0 };
        months[month].sales++;
        months[month].total += Number(o.total || 0);
      }
      return months;
    }),
  );
  return { issueSession };
}
module.exports = { registerOperations };
