const profile = require("../../config/stores/conflora.example.json");
const { rankProductSales } = require("../catalog/product-sales");
const { productStatus } = require("../catalog/product-status");
const { resolveHdProductImage } = require("../catalog/image-resolver");
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
  const name = item.name || item.descricao || "Produto";
  const subcategory = String(item.subcategory || item.subcategoria || "");
  const unit = item.unit || item.unidade || "UN";
  const photo = (value) =>
    typeof value === "string" &&
    (/^https:\/\/(?:firebasestorage|storage)\.googleapis\.com\//.test(value) ||
      /^\/api\/images\//.test(value) ||
      /^gs:\/\/[a-z0-9._-]+\/products\/[a-z0-9_-]+\/[a-z0-9._-]+$/i.test(value) ||
      /^products\/[a-z0-9_-]+\/[a-z0-9._-]+$/i.test(value))
      ? value
      : "";
  const images = (Array.isArray(item.images) ? item.images : [])
    .map((image) => ({
      url: photo(typeof image === "string" ? image : image.url || image.imageUrl || image.src || image.downloadURL || image.storagePath || image.fullPath || image.path),
      alt: name,
    }))
    .filter((image, index, all) => image.url && all.findIndex((candidate) => candidate.url === image.url) === index);
  const primaryImage = photo(item.imageUrl || item.imageurl || item.imagePathCache || item.imageURL || item.imagePath || item.storagePath);
  const imagePaths = Array.isArray(item.imagePaths) ? item.imagePaths.map((imagePath) => photo(imagePath)).filter(Boolean) : [];
  const registeredImages = [...new Set([primaryImage, ...images.map((image) => image.url), ...imagePaths].filter(Boolean))];
  const registeredImage = registeredImages[0] || "";
  const imageFileId = String(item.imageFileId || item.image_file_id || "").trim();
  const storageImageProxy = imageFileId
    ? `/api/images/${encodeURIComponent(imageFileId)}`
    : "";
  const imageCandidates = [...new Set([
    ...registeredImages,
    storageImageProxy,
  ].filter(Boolean))];
  return {
    id: String(item.id),
    name,
    canonicalName: item.canonicalName || item.canonical_name || name,
    variation: item.variation || item.variacao || item.variationLabel || item.apresentacao || "",
    description: item.description || item.descriptionAi || "",
    price: {
      amountMinor: Math.round(Number(item.price ?? item.valor_num ?? 0) * 100),
      currency: "BRL",
    },
    imageUrl: imageCandidates[0] || resolveHdProductImage(name, category, subcategory),
    imageIsIllustrative: !registeredImage,
    imageFallbackUrl: "/store-assets/placeholder.svg",
    images: imageCandidates,
    imageFileId,
    categories: [digest(category).slice(0, 16)],
    categoryName: category,
    subcategoryName: subcategory,
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
    isAvailable: productStatus(item) === "ATIVO",
    status:
      String(item.status || "ATIVO").trim().toUpperCase() === "INATIVO"
        ? "INATIVO"
        : "ATIVO",
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
    descriptionAi: item.descriptionAi || item.descricao_ia || "",
    careInstructions: item.careInstructions || item.care || item.cuidados_basicos || item.cuidadosBasicos || "",
    cuidados_basicos: item.cuidados_basicos || item.cuidadosBasicos || "",
    iluminacao: item.iluminacao || item.iluminação || item.illumination || item.lighting || "",
    illumination: item.illumination || item.iluminacao || item.iluminação || item.lighting || item.dicas_iluminacao || "",
    watering: item.watering || item.wateringInstructions || item.rega || item.irrigacao || item.frequencia_rega || "",
    ambiente_ideal: item.ambiente_ideal || item.ambienteIdeal || "",
    environment: item.environment || item.ambiente_ideal || item.ambienteIdeal || item.habitat || "",
    dicas_armazenamento: item.dicas_armazenamento || item.dicasArmazenamento || "",
    storageTips: item.storageTips || item.storage || item.dicas_armazenamento || item.dicasArmazenamento || "",
    durabilidade: item.durabilidade || "",
    durability: item.durability || item.durabilidade || item.validade || "",
    preferences: item.preferences || item.o_que_gosta || item.oQueGosta || item.gosta_de || "",
    dislikes: item.dislikes || item.o_que_evitar || item.oQueEvitar || item.nao_gosta || "",
    usage: item.usage || item.uso || item.modo_de_uso || item.modoDeUso || "",
    selectionTips: item.selectionTips || item.dica_escolha || item.dicaEscolha || "",
    suitability: item.suitability || item.indicacao || item.indicação || item.especie_indicada || "",
    matureSize: item.matureSize || item.porte_adulto || item.porteAdulto || item.tamanho_adulto || item.tamanhoAdulto || "",
    precautions: item.precautions || item.precaucoes || item.precauções || item.cuidados_de_uso || "",
    alimentacao: item.alimentacao || item.alimentação || item.feeding || item.dieta || "",
    feeding: item.feeding || item.alimentacao || item.alimentação || item.dieta || "",
  };
}
function existingConfig(products, saved, settings = { stockControlEnabled: true }) {
  const activeProducts = products.filter(
    (p) => p.isAvailable && p.status !== "INATIVO",
  );
  if (saved?.config) {
    const result = structuredClone(saved.config);
    result.branding ||= {};
    result.branding.logoUrl ||= profile.branding.logoUrl;
    result.checkout ||= structuredClone(profile.checkout);
    result.checkout.contactPhone ||=
      process.env.OWNER_WHATSAPP_NUMBER || profile.checkout?.contactPhone || "5564999351616";
    for (const product of activeProducts) {
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
    result.inventory = {
      stockControlEnabled: settings?.stockControlEnabled !== false,
    };
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
      activeProducts.map((p) => [
        p.categories[0],
        { id: p.categories[0], name: p.categoryName, isActive: true },
      ]),
    ).values(),
  ].map((c, order) => ({ ...c, order }));
  config.inventory = {
    stockControlEnabled: settings?.stockControlEnabled !== false,
  };
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
        const category = saved?.config?.categories?.find(
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
          !saved?.config?.categories?.some(
            (category) =>
              p.categories.includes(category.id) && !category.isActive,
          ),
      );
  }
  app.get("/api/storefront/catalog", async (_req, res, next) => {
    try {
      let settings = { stockControlEnabled: true };
      if (repository.getInventorySettings) {
        try {
          settings = await repository.getInventorySettings();
        } catch {
          settings = { stockControlEnabled: true };
        }
      }
      const items = await products();
      const config = existingConfig(items, await readSettings());
      const visibleCategories = new Set(items.flatMap((item) => item.categories));
      config.categories = config.categories.filter(
        (category) => category.isActive && visibleCategories.has(category.id),
      );
      res
        .set("Cache-Control", "no-store")
        .json({
          config: existingConfig(items, await readSettings(), settings),
          products: items,
        });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/storefront/assistant", async (req, res, next) => {
    try {
      const allItems = await products();
      const items = allItems.filter(
        (p) => p.isAvailable && p.status !== "INATIVO",
      );
      const saved = await readSettings();
      let settings = { stockControlEnabled: true };
      if (repository.getInventorySettings) {
        try {
          settings = await repository.getInventorySettings();
        } catch {
          settings = { stockControlEnabled: true };
        }
      }
      const config = existingConfig(items, saved, settings);
      ensure(
        config.assistant.enabled && config.assistant.mode === "AI",
        "Use o guia de categorias: a consultoria por IA está desativada nesta loja.",
        409,
      );
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
  app.get("/api/storefront/inventory-settings", async (_req, res, next) => {
    try {
      let settings = { stockControlEnabled: true };
      if (repository.getInventorySettings) {
        try {
          settings = await repository.getInventorySettings();
        } catch {
          settings = { stockControlEnabled: true };
        }
      }
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });
  app.put("/api/storefront/inventory-settings", async (req, res, next) => {
    try {
      if (typeof req.body?.stockControlEnabled !== "boolean") {
        return res
          .status(400)
          .json({ error: "Informe uma opção válida de controle de estoque." });
      }
      let result = req.body;
      if (repository.saveInventorySettings) {
        result = await repository.saveInventorySettings(req.body);
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/storefront/products", async (req, res, next) => {
    try {
      const data = req.body;
      ensure(data && typeof data === "object", "Dados do produto inválidos.");
      ensure(
        typeof data.name === "string" && data.name.trim().length >= 2,
        "Nome do produto é obrigatório.",
      );
      const product = {
        id: data.id
          ? String(data.id)
          : `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: String(data.name).trim(),
        price: Number(data.price || 0),
        stockQuantity: Number(data.stockQuantity ?? data.stock ?? 0),
        status:
          String(data.status || "ATIVO").trim().toUpperCase() === "INATIVO"
            ? "INATIVO"
            : "ATIVO",
        unit: String(data.unit || "UN").trim().toUpperCase(),
        category: String(data.category || "Geral").trim(),
        subcategory: String(data.subcategory || "").trim(),
        imageUrl: String(data.imageUrl || "").trim(),
        description: String(data.description || "").trim(),
        tags: Array.isArray(data.tags)
          ? data.tags
          : typeof data.tags === "string"
            ? data.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
        updatedAt: new Date().toISOString(),
      };
      if (repository.saveProduct) {
        await repository.saveProduct(product);
      }
      res.status(200).json({ success: true, product });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/storefront/stock/quick-entry", async (req, res, next) => {
    try {
      const { productId, quantityAdded } = req.body;
      ensure(productId, "ID do produto é obrigatório.");
      const qty = Number(quantityAdded || 0);
      ensure(qty > 0, "Quantidade deve ser maior que zero.");
      let result = { success: true };
      if (repository.quickAddStock) {
        result = await repository.quickAddStock(productId, qty);
      }
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });
  app.put("/api/storefront/products/:id/status", async (req, res, next) => {
    try {
      const { status } = req.body;
      const targetStatus =
        String(status).trim().toUpperCase() === "INATIVO"
          ? "INATIVO"
          : "ATIVO";
      let existing;
      if (repository.getProductById) {
        existing = await repository.getProductById(req.params.id);
      }
      ensure(existing, "Produto não encontrado.", 404);
      existing.status = targetStatus;
      if (repository.saveProduct) {
        await repository.saveProduct(existing);
      }
      res.json({ success: true, product: existing });
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
      /^\d{10,11}$/.test(input.customer.phone.replace(/\D/g, "")),
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
        String(input.address || "").trim().length >= 8),
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
  const deliveryFeeMinor =
    input.fulfillment === "delivery"
      ? storeConfig.checkout.delivery.feeMinor
      : 0;
  const cashTenderedMinor = Number(input.cashTenderedMinor || 0);
  const orderTotalMinor =
    items.reduce(
      (sum, item) => sum + Math.round(item.price * 100 * item.quantity),
      0,
    ) + deliveryFeeMinor;
  ensure(
    Number.isSafeInteger(cashTenderedMinor) && cashTenderedMinor >= 0,
    "Valor informado para troco inválido.",
  );
  ensure(
    input.paymentMethod !== "CASH" || cashTenderedMinor >= orderTotalMinor,
    "Informe o valor recebido para calcular o troco.",
  );
  req.body = {
    customerName: String(input.customer?.name || "").trim(),
    customerPhone: String(input.customer?.phone || "").replace(/\D/g, ""),
    orderType: input.fulfillment === "delivery" ? "DELIVERY" : "PICKUP",
    deliveryAddress: input.address,
    paymentMethod: { PIX: "PIX", CARD: "CARTAO", CASH: "DINHEIRO" }[
      input.paymentMethod
    ],
    cashTendered: cashTenderedMinor / 100,
    items,
    subtotal:
      total +
      (input.fulfillment === "delivery"
        ? storeConfig.checkout.delivery.feeMinor / 100
        : 0),
    discount: 0,
    changeDue: Math.max(0, cashTenderedMinor / 100 - orderTotalMinor / 100),
  };
}
async function readStoreSettings(repository) {
  if (repository.firestore && !repository._firestoreClientDisabled) {
    try {
      const snap = await repository.firestore
        .collection("store_settings")
        .doc("storefront")
        .get();
      return snap.data();
    } catch (err) {
      if (
        err.code === 7 ||
        err.code === "permission-denied" ||
        err.message?.includes("PERMISSION_DENIED") ||
        err.message?.includes("Missing or insufficient")
      ) {
        repository._firestoreClientDisabled = true;
      }
    }
  }
  return repository.storefrontSettings;
}
module.exports = {
  installExistingStore,
  normalizeExistingCheckout,
  toProduct,
  readStoreSettings,
  existingConfig,
};
