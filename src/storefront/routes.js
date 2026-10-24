const path = require("node:path");
const { StoreRepository } = require("./repository");
const { StoreAssistant } = require("./assistant");
const { createStoreAuth } = require("./auth");
const {
  ensure,
  text,
  identifier,
  validateConfig,
  validateProduct,
  digest,
} = require("./validation");
const { deliverOrder, validateWebhook } = require("./order-delivery");

function installStorefront(app, { express, firestore, repository, assistant }) {
  const repo = repository || new StoreRepository({ firestore });
  const consultant = assistant || new StoreAssistant();
  const auth = createStoreAuth(repo);
  const router = express.Router({ mergeParams: true });
  const assets = path.resolve(__dirname, "../../public/storefront");
  const exists = require('node:fs').existsSync;
  const shell = () => path.join(assets, exists(path.join(assets, 'shell.html')) ? 'shell.html' : 'index.html');
  const brandImages = new Map();
  app.get('/storefront/sw.js', (_req, res) => {
    res.set('Service-Worker-Allowed', '/').set('Cache-Control', 'no-cache')
      .sendFile(exists(path.join(assets, 'sw-built.js')) ? 'sw-built.js' : 'sw.js', { root: assets });
  });
  app.get("/store-assets/brands/:file", async (req, res, next) => {
    if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(req.params.file)) {
      return res.sendStatus(404);
    }
    try {
      if (!brandImages.has(req.params.file)) {
        const sharp = require("sharp");
        const buffer = await sharp(path.join(assets, "brands", req.params.file))
          .resize({
            width: 480,
            height: 168,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 92 })
          .toBuffer();
        brandImages.set(req.params.file, buffer);
      }
      res
        .set("Cache-Control", "no-cache, must-revalidate")
        .type("image/webp")
        .send(brandImages.get(req.params.file));
    } catch (error) {
      if (
        error.code === "ENOENT" ||
        error.message.includes("Input file is missing")
      ) {
        return res.sendStatus(404);
      }
      next(error);
    }
  });
  const staticOptions = {
    setHeaders: (res, file) => {
      const hashed = /[/\\]dist[/\\]versioned[/\\][\w-]+-(?:[a-f0-9]{16}|[A-Z0-9]{8})\.(?:js|css|webp|png|svg)$/.test(file);
      res.setHeader("Cache-Control", hashed ? 'public, max-age=31536000, immutable' : "no-cache, must-revalidate");
    },
  };
  app.use(
    ["/store-assets/v2", "/store-assets/v3", "/store-assets/v4", "/store-assets/v5"],
    express.static(assets, staticOptions)
  );
  app.use("/store-assets", express.static(assets, staticOptions));
  app.use("/storefront", express.static(assets, staticOptions));
  app.use("/assets", express.static(path.resolve(__dirname, "../../public/assets"), staticOptions));
  app.get(
    ["/shop/:slug", "/shop/:slug/products/:productId", "/shop/:slug/admin"],
    async (req, res, next) => {
      try {
        ensure(
          await repo.config(identifier(req.params.slug)),
          "Loja não encontrada.",
          404,
        );
        res
          .set("Cache-Control", "no-store")
          .sendFile(path.basename(shell()), { root: assets });
      } catch (error) {
        next(error);
      }
    },
  );
  router.use(async (req, res, next) => {
    try {
      req.tenantId = identifier(req.params.slug);
      req.storeConfig = await repo.config(req.tenantId);
      ensure(req.storeConfig, "Loja não encontrada.", 404);
      res.set("Cache-Control", "no-store");
      if (!["GET", "HEAD"].includes(req.method)) {
        const origin = req.headers.origin;
        ensure(
          !origin || new URL(origin).host === req.headers.host,
          "Origem inválida.",
          403,
        );
        ensure(
          req.headers["sec-fetch-site"] !== "cross-site",
          "Origem inválida.",
          403,
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  });
  router.use(auth.resolve);
  const handle = (fn) => async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
  const requireAdmin = (req, _res, next) => {
    try {
      ensure(
        req.storeUser?.role === "ADMIN",
        "Acesso administrativo necessário.",
        403,
      );
      next();
    } catch (error) {
      next(error);
    }
  };
  const limit = async (req, action, maximum) => {
    const id = digest(`${action}:${req.ip}:${Math.floor(Date.now() / 60000)}`);
    await repo.atomic(req.tenantId, async (tx) => {
      const record = await tx.get("rateLimits", id);
      ensure(
        (record?.count || 0) < maximum,
        "Muitas tentativas. Aguarde um minuto.",
        429,
      );
      tx.put("rateLimits", id, {
        count: (record?.count || 0) + 1,
        expiresAt: new Date(Date.now() + 120000),
      });
    });
  };
  router.get("/config", (req, res) => res.json(req.storeConfig));
  router.get(
    "/products",
    handle(async (req, res) => {
      let products = (await repo.list(req.tenantId, "products")).filter(
        (p) => p.isAvailable,
      );
      const limit = Number.parseInt(req.query.limit, 10);
      const page = Number.parseInt(req.query.page, 10) || 1;
      const category = req.query.category ? String(req.query.category).trim().toLowerCase() : '';
      const search = req.query.search ? String(req.query.search).trim().toLowerCase() : '';

      if (category) {
        products = products.filter(p =>
          (p.categoryName && p.categoryName.toLowerCase().includes(category)) ||
          (Array.isArray(p.categories) && p.categories.some(c => String(c).toLowerCase() === category))
        );
      }
      if (search) {
        products = products.filter(p =>
          (p.name && p.name.toLowerCase().includes(search)) ||
          (p.canonicalName && p.canonicalName.toLowerCase().includes(search))
        );
      }

      if (limit && limit > 0) {
        const startIndex = (page - 1) * limit;
        const paginated = products.slice(startIndex, startIndex + limit);
        return res.json({
          products: paginated,
          pagination: {
            page,
            limit,
            totalItems: products.length,
            totalPages: Math.ceil(products.length / limit),
            hasMore: startIndex + limit < products.length,
          },
        });
      }

      return res.json(products);
    }),
  );
  router.get(
    "/images/:id",
    handle(async (req, res) => {
      const image = await repo.get(
        req.tenantId,
        "images",
        identifier(req.params.id),
      );
      ensure(
        image &&
          ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
            image.contentType,
          ),
        "Imagem não encontrada.",
        404,
      );
      res
        .set("X-Content-Type-Options", "nosniff")
        .type(image.contentType)
        .send(Buffer.from(image.data, "base64"));
    }),
  );
  router.get("/me", (req, res) => res.json({ user: req.storeUser || null }));
  for (const action of ["register", "login"]) {
    router.post(
      `/auth/${action}`,
      handle(async (req, res) => {
        await limit(req, "auth", 10);
        const user = await auth[action](req);
        res.json({ user: await auth.issue(req, res, user) });
      }),
    );
  }
  router.post(
    "/auth/logout",
    handle(async (req, res) => {
      await auth.logout(req, res);
      res.json({ success: true });
    }),
  );
  router.get(
    "/orders",
    handle(async (req, res) => {
      ensure(req.storeUser, "Entre na sua conta.", 401);
      const orders = await repo.list(req.tenantId, "orders");
      res.json(
        orders
          .filter((order) => order.customerId === req.storeUser.id)
          .map(({ fingerprint: _fingerprint, ...order }) => order),
      );
    }),
  );
  router.post(
    "/orders",
    handle(async (req, res) => {
      await limit(req, "orders", 15);
      const body = req.body || {};
      ensure(
        Array.isArray(body.items) &&
          body.items.length > 0 &&
          body.items.length <= 100,
        "Sacola inválida.",
      );
      const items = body.items.map((item) => {
        ensure(
          Number.isFinite(item.quantity) &&
            item.quantity > 0 &&
            item.quantity <= 100000,
          "Quantidade inválida.",
        );
        return {
          productId: identifier(item.productId),
          quantity: item.quantity,
        };
      });
      ensure(
        new Set(items.map((i) => i.productId)).size === items.length,
        "Produtos duplicados.",
      );
      const phone = text(body.customer?.phone, 25, true).replace(/\D/g, "");
      ensure(phone.length >= 10 && phone.length <= 15, "Telefone inválido.");
      const cashTenderedMinor = body.cashTenderedMinor || 0;
      ensure(
        Number.isSafeInteger(cashTenderedMinor) && cashTenderedMinor >= 0,
        "Valor em dinheiro inválido.",
      );
      const order = await repo.createOrder(
        req.tenantId,
        {
          items,
          customer: { name: text(body.customer?.name, 100, true), phone },
          address: text(body.address, 500),
          serviceArea: text(body.serviceArea, 100),
          paymentMethod: body.paymentMethod,
          fulfillment: body.fulfillment,
          cashTenderedMinor,
          ...(body.deliveryLocation && typeof body.deliveryLocation === "object" ? { deliveryLocation: body.deliveryLocation } : {}),
        },
        req.storeUser?.id || null,
        identifier(req.headers["idempotency-key"]),
      );
      const safeOrder = { ...order };
      delete safeOrder.fingerprint;
      // Delivery failure never turns a successfully persisted order into a failed checkout.
      await deliverOrder(repo, req.tenantId, order.id).catch(() => {});
      res.status(201).json(safeOrder);
    }),
  );
  router.post(
    "/assistant",
    handle(async (req, res) => {
      ensure(
        req.storeConfig.assistant.enabled && req.storeConfig.assistant.mode !== "GUIDED",
        "Assistente desabilitado.",
        404,
      );
      await limit(req, "assistant", 8);
      const settings =
        (await repo.get(req.tenantId, "privateConfig", "current")) || {};
      const products = await repo.list(req.tenantId, "products");
      res.json(
        await consultant.recommend(
          req.storeConfig,
          settings.assistant || {},
          products,
          req.body || {},
        ),
      );
    }),
  );
  router.use("/admin", requireAdmin);
  router.get(
    "/admin/config",
    handle(async (req, res) => {
      const settings =
        (await repo.get(req.tenantId, "privateConfig", "current")) || {};
      res.json({
        config: req.storeConfig,
        assistant: settings.assistant || {},
        integrations: {
          orderWebhookUrl: settings.integrations?.orderWebhookUrl || "",
          webhookSecretRef: settings.integrations?.webhookSecretRef || "",
        },
      });
    }),
  );
  router.put(
    "/admin/config",
    handle(async (req, res) => {
      const config = validateConfig(
        { ...req.body.config, slug: req.tenantId },
        req.tenantId,
      );
      const settings = req.body.assistant || {};
      await repo.atomic(req.tenantId, async (tx) => {
        const current = await tx.get("publicConfig", "current");
        const privateConfig = (await tx.get("privateConfig", "current")) || {};
        ensure(
          req.body.config.version === current.version,
          "Configuração alterada por outro usuário. Recarregue.",
          409,
        );
        config.version = current.version + 1;
        tx.put("publicConfig", "current", config);
        tx.put("privateConfig", "current", {
          ...privateConfig,
          ...(req.body.integrations
            ? { integrations: validateWebhook(req.body.integrations) }
            : {}),
          assistant: {
            persona: text(settings.persona, 2000),
            instructions: text(settings.instructions, 4000),
            webSearchEnabled: !!settings.webSearchEnabled,
          },
        });
      });
      res.json(config);
    }),
  );
  router.get(
    "/admin/products",
    handle(async (req, res) =>
      res.json(await repo.list(req.tenantId, "products")),
    ),
  );
  router.put(
    "/admin/products/:id",
    handle(async (req, res) => {
      const product = validateProduct(
        { ...req.body, id: req.params.id },
        req.tenantId,
        req.storeConfig,
      );
      await repo.atomic(req.tenantId, async (tx) => {
        const previous = await tx.get("products", product.id);
        ensure(
          !previous || req.body.revision === previous.revision,
          "Produto alterado. Recarregue antes de salvar.",
          409,
        );
        tx.put("products", product.id, {
          ...product,
          salesCount: previous?.salesCount || 0,
        });
      });
      res.json(product);
    }),
  );
  router.delete(
    "/admin/products/:id",
    handle(async (req, res) => {
      await repo.atomic(req.tenantId, async (tx) => {
        const product = await tx.get("products", identifier(req.params.id));
        ensure(product, "Produto não encontrado.", 404);
        tx.put("products", product.id, {
          ...product,
          isAvailable: false,
          revision: repo.newId(),
          updatedAt: new Date().toISOString(),
        });
      });
      res.json({ success: true });
    }),
  );
  router.get(
    "/admin/orders",
    handle(async (req, res) =>
      res.json(
        (await repo.list(req.tenantId, "orders")).map(
          ({ fingerprint: _fingerprint, ...order }) => order,
        ),
      ),
    ),
  );
  router.patch(
    "/admin/orders/:id",
    handle(async (req, res) =>
      res.json(
        await repo.updateOrder(req.tenantId, req.params.id, req.body.status),
      ),
    ),
  );
  router.use((error, _req, res, _next) =>
    res
      .status(error.status || 503)
      .json({
        error: error.status
          ? error.message
          : "Serviço temporariamente indisponível. Tente novamente.",
      }),
  );
  app.use("/api/stores/:slug", router);
  return repo;
}
module.exports = { installStorefront };
