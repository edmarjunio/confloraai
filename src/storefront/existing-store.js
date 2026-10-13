const profile = require("../../config/stores/conflora.example.json");
const { rankProductSales } = require("../catalog/product-sales");
const {
  ensure,
  digest,
  StoreError,
  validateConfig,
  text,
} = require("./validation");

// Compatibility boundary for the existing store. SaaS tenants never use these collections.
function toProduct(item, { stockControlEnabled = true } = {}) {
  const category = String(item.category || item.categoria || "Geral");
  const unit = item.unit || item.unidade || "UN";
  const photo = (value) =>
    typeof value === "string" &&
    /^(https:\/\/|\/api\/images\/|\/store-assets\/)/.test(value)
      ? value
      : "";
  return {
    id: String(item.id),
    name: item.name || item.descricao || "Produto",
    description: item.description || item.descriptionAi || "",
    price: {
      amountMinor: Math.round(Number(item.price ?? item.valor_num ?? 0) * 100),
      currency: "BRL",
    },
    imageUrl: photo(item.imageUrl || item.imageurl),
    images: (Array.isArray(item.images) ? item.images : [])
      .map((image) => ({
        url: photo(typeof image === "string" ? image : image.url),
        alt: item.name || "",
      }))
      .filter((image) => image.url),
    categories: [digest(category).slice(0, 16)],
    categoryName: category,
    subcategoryName: String(item.subcategory || item.subcategoria || ""),
    navigationPath: [
      category,
      String(item.subcategory || item.subcategoria || ""),
    ].filter(Boolean),
    searchAliases: [item.tagsAi, item.tags_ia]
      .filter((value) => typeof value === "string")
      .flatMap((value) => value.split(/[,;\n]/))
      .map((value) => value.trim())
      .filter(Boolean),
    tags: (Array.isArray(item.tags) ? item.tags : []).filter(
      (tag) => typeof tag === "string",
    ),
    specifications: Object.fromEntries(
      Object.entries(item.specifications || {}).filter(
        ([, value]) =>
          value &&
          typeof value.label === "string" &&
          typeof value.value === "string",
      ),
    ),
    contentSections: (Array.isArray(item.contentSections)
      ? item.contentSections
      : []
    ).filter(
      (section) =>
        section &&
        typeof section.title === "string" &&
        typeof section.body === "string",
    ),
    isAvailable:
      String(item.status || "ATIVO")
        .trim()
        .toUpperCase() !== "INATIVO",
    stock: {
      tracked: stockControlEnabled,
      quantity: Math.max(0, Number(item.stockQuantity ?? item.estoque ?? 0)),
    },
    saleUnit: {
      code: unit,
      label: unit === "UN" ? "unidade" : unit,
      minimum: unit === "KG" ? 0.1 : 1,
      increment: unit === "KG" ? 0.1 : 1,
    },
    salesCount: Number(item.salesCount) || 0,
  };
}
function existingConfig(products, saved) {
  if (saved?.config) {
    const result = structuredClone(saved.config);
    for (const product of products) {
      if (
        !result.categories.some(
          (category) => category.id === product.categories[0],
        )
      ) {
        result.categories.push({
          id: product.categories[0],
          name: product.categoryName,
          isActive: true,
          order: result.categories.length,
        });
      }
    }
    return result;
  }
  const config = structuredClone(profile);
  config.assistant.mode =
    process.env.STOREFRONT_CHAT_MODE === "AI" ? "AI" : "GUIDED";
  config.assistant.synonyms = [];
  if (config.assistant.mode === "GUIDED") {
    config.assistant.displayName = "Guia de compras";
  }
  config.branding.colors.background = "#FFFFFF";
  config.categories = [
    ...new Map(
      products.map((p) => [
        p.categories[0],
        { id: p.categories[0], name: p.categoryName, isActive: true },
      ]),
    ).values(),
  ].map((c, order) => ({ ...c, order }));
  // Preserve the checkout settings already published by the existing storefront.
  config.checkout.pix = {
    key: process.env.STORE_PIX_KEY || "64999351616",
    recipientName: config.identity.name,
  };
  config.checkout.contactPhone =
    process.env.OWNER_WHATSAPP_NUMBER || "5564999351616";
  config.checkout.enabledPayments = ["PIX", "CARD", "CASH"];
  config.checkout.delivery = {
    enabled: true,
    label: "Entrega",
    serviceAreas: ["Mineiros - GO"],
    feeMinor: 0,
  };
  config.checkout.pickup.label = "Retirada na loja";
  return config;
}
function installExistingStore(app, { repository, assistant }) {
  const readSettings = () => readStoreSettings(repository);
  const admin = (req) =>
    ensure(
      req.user?.role === "ADMIN",
      "Acesso administrativo necessário.",
      req.user ? 403 : 401,
    );
  app.get("/api/storefront/admin/config", async (req, res, next) => {
    try {
      admin(req);
      const saved = await readSettings();
      res.json({
        config: existingConfig(await products(), saved),
        assistant: saved?.assistant || {},
        integrations: {},
      });
    } catch (error) {
      next(error);
    }
  });
  app.put("/api/storefront/admin/config", async (req, res, next) => {
    try {
      admin(req);
      const config = validateConfig(
        { ...req.body.config, slug: "conflora" },
        "conflora",
      );
      ensure(
        !req.body.integrations?.orderWebhookUrl,
        "Webhooks são configurados no painel de lojas SaaS.",
      );
      const value = {
        config,
        assistant: {
          persona: text(req.body.assistant?.persona, 2000),
          instructions: text(req.body.assistant?.instructions, 4000),
          webSearchEnabled: !!req.body.assistant?.webSearchEnabled,
        },
      };
      const update = (current) => {
        ensure(
          req.body.config.version === (current?.config.version || 1),
          "Configuração alterada. Recarregue a página.",
          409,
        );
        value.config.version = (current?.config.version || 1) + 1;
      };
      if (repository.firestore) {
        const ref = repository.firestore
          .collection("store_settings")
          .doc("storefront");
        await repository.firestore.runTransaction(async (tx) => {
          update((await tx.get(ref)).data());
          tx.set(ref, value);
        });
      } else {
        update(repository.storefrontSettings);
        repository.storefrontSettings = value;
      }
      res.json(config);
    } catch (error) {
      next(error);
    }
  });
  app.get("/storefront-auth.js", (_req, res) => {
    const { renderFirebaseAuthScript } = require("../http/firebase-client");
    const script = renderFirebaseAuthScript()
      .replace(/^<script type="module">/, "")
      .replace(/<\/script>$/, "");
    res
      .set("Cache-Control", "no-store")
      .type("application/javascript")
      .send(script);
  });
  async function products() {
    let records = await repository.getAllProducts();
    if (repository.getSalesOrders) {
      try {
        records = rankProductSales(records, await repository.getSalesOrders());
      } catch {
        // preserve unranked records
      }
    }
    let settings = { stockControlEnabled: true };
    if (repository.getInventorySettings) {
      try {
        settings = await repository.getInventorySettings();
      } catch {
        settings = { stockControlEnabled: true };
      }
    }
    const saved = await readSettings();
    return records
      .map((item) => {
        const product = toProduct(item, settings);
        const category = saved?.config.categories.find(
          (category) =>
            category.name.toLocaleLowerCase() ===
            product.categoryName.toLocaleLowerCase(),
        );
        if (category) {
          product.categories = [category.id];
        }
        return product;
      })
      .filter(
        (p) =>
          p.isAvailable &&
          !saved?.config.categories.some(
            (category) =>
              p.categories.includes(category.id) && !category.isActive,
          ),
      );
  }
  app.get("/api/storefront/catalog", async (_req, res, next) => {
    try {
      const items = await products();
      res
        .set("Cache-Control", "no-store")
        .json({
          config: existingConfig(items, await readSettings()),
          products: items,
        });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/storefront/assistant", async (req, res, next) => {
    try {
      const items = await products();
      const saved = await readSettings();
      const config = existingConfig(items, saved);
      ensure(config.assistant.enabled && config.assistant.mode === "AI", "Use o guia de categorias: a consultoria por IA está desativada nesta loja.", 409);
      res.json(
        await assistant.recommend(
          config,
          saved?.assistant || {
            persona: "",
            instructions: "",
            webSearchEnabled: false,
          },
          items,
          req.body,
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  app.use("/api/storefront", (error, _req, res, _next) => {
    const known = error instanceof StoreError;
    res.status(known ? error.status : 503).json({
      error: known
        ? error.message
        : "O serviço está temporariamente indisponível. Tente novamente em instantes.",
    });
  });
}
async function normalizeExistingCheckout(req, repository) {
  if (req.path !== "/api/storefront/orders") {
    return;
  }
  const input = req.body;
  const storeConfig = existingConfig([], await readStoreSettings(repository));
  req.storeConfig = storeConfig;
  ensure(input && typeof input === "object", "Pedido inválido.");
  ensure(
    typeof input.customer?.name === "string" &&
      input.customer.name.trim().length >= 2 &&
      input.customer.name.length <= 100,
    "Informe seu nome.",
  );
  ensure(
    typeof input.customer?.phone === "string" &&
      /^\d{10,13}$/.test(input.customer.phone.replace(/\D/g, "")),
    "Informe um telefone com DDD.",
  );
  ensure(
    Array.isArray(input.items) &&
      input.items.length > 0 &&
      input.items.length <= 100,
    "Sacola inválida.",
  );
  ensure(
    ["delivery", "pickup"].includes(input.fulfillment),
    "Escolha entrega ou retirada.",
  );
  ensure(
    storeConfig.checkout.enabledPayments.includes(input.paymentMethod),
    "Pagamento inválido.",
  );
  ensure(
    storeConfig.checkout[input.fulfillment]?.enabled,
    "Opção de entrega ou retirada indisponível.",
  );
  ensure(
    input.fulfillment !== "delivery" ||
      (storeConfig.checkout.delivery.serviceAreas.includes(input.serviceArea) &&
        String(input.address || "").trim().length >= 5),
    "Informe um endereço na região atendida pela loja.",
  );
  const settings = await repository.getInventorySettings();
  const catalog = new Map(
    (await repository.getAllProducts()).map((item) => [
      String(item.id),
      toProduct(item, settings),
    ]),
  );
  const quantities = new Map();
  for (const item of input.items) {
    ensure(
      typeof item.quantity === "number" &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0,
      "Quantidade inválida.",
    );
    quantities.set(
      String(item.productId),
      (quantities.get(String(item.productId)) || 0) + item.quantity,
    );
  }
  const items = [...quantities].map(([id, quantity]) => {
    const product = catalog.get(id);
    ensure(
      product?.isAvailable &&
        (!product.stock.tracked || product.stock.quantity >= quantity),
      "Produto ou quantidade indisponível.",
    );
    const steps = quantity / product.saleUnit.increment;
    ensure(
      quantity >= product.saleUnit.minimum &&
        Math.abs(steps - Math.round(steps)) < 0.00001,
      "Quantidade inválida para a unidade.",
    );
    return {
      id,
      productId: id,
      name: product.name,
      price: product.price.amountMinor / 100,
      quantity,
      unit: product.saleUnit.code,
    };
  });
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  req.body = {
    customerName: String(input.customer?.name || "").trim(),
    customerPhone: String(input.customer?.phone || "").replace(/\D/g, ""),
    orderType: input.fulfillment === "delivery" ? "DELIVERY" : "PICKUP",
    deliveryAddress: input.address,
    paymentMethod: { PIX: "PIX", CARD: "CARTAO", CASH: "DINHEIRO" }[
      input.paymentMethod
    ],
    cashTendered: Number(input.cashTenderedMinor || 0) / 100,
    items,
    subtotal:
      total +
      (input.fulfillment === "delivery"
        ? storeConfig.checkout.delivery.feeMinor / 100
        : 0),
    discount: 0,
    changeDue: Math.max(0, Number(input.cashTenderedMinor || 0) / 100 - total),
  };
}
async function readStoreSettings(repository) {
  return repository.firestore
    ? (
        await repository.firestore
          .collection("store_settings")
          .doc("storefront")
          .get()
      ).data()
    : repository.storefrontSettings;
}
module.exports = {
  installExistingStore,
  normalizeExistingCheckout,
  toProduct,
  readStoreSettings,
  existingConfig,
};
