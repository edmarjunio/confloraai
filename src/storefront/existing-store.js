const profile = require("../../config/stores/conflora.json");
const { productStatus } = require("../catalog/product-status");
const {
  ensure,
  digest,
  StoreError,
  validateConfig,
  text,
} = require("./validation");

// Compatibility boundary for the existing store. SaaS tenants never use these collections.
function toProduct(rawItem, { stockControlEnabled = true } = {}) {
  const item = require('../catalog/normalize-catalog-item').normalizeCatalogItem(rawItem);
  const commercial = require('../catalog/commercial-product').commercialProduct(item);
  const category = String(item.category || item.categoria || item.CATEGORIA || "Geral");
  const name = commercial.name || "Produto";
  const subcategory = String(item.subcategory || item.subcategoria || item.SUBCATEGORIA || "");
  const unit = commercial.unit;
  const registeredImages = require('../catalog/actual-product-photo').actualProductImages(item);
  const registeredImage = registeredImages[0] || "";
  const imageFileId = registeredImage ? String(item.imageFileId || item.image_file_id || "").trim() : '';
  const storageImageProxy = imageFileId
    ? `/api/images/${encodeURIComponent(imageFileId)}`
    : "";
  const imageCandidates = [...new Set([
    ...registeredImages,
    storageImageProxy,
  ].filter(Boolean))];
  const res = {
    id: String(item.id),
    sku: item.sku,
    productInfo: item.productInfo,
    media: item.media,
    inventory: item.inventory,
    name,
    nameTranslations: Object.fromEntries(['en', 'es', 'fr'].filter(language =>
      typeof item.nameTranslations?.[language] === 'string' && item.nameTranslations[language].trim().length <= 180)
      .map(language => [language, item.nameTranslations[language].trim()])),
    canonicalName: item.canonicalName || item.canonical_name || name,
    productType: item.productType || item.tipoProduto || item.tipo || "",
    variation: item.variation || item.variacao || item.variationLabel || item.apresentacao || "",
    description: item.description || item.descriptionAi || "",
    price: {
      amountMinor: commercial.priceMinor,
      currency: "BRL",
    },
    imageUrl: imageCandidates[0] || '',
    imageIsIllustrative: false,
    actualPhotoPending: !registeredImage,
    imageFallbackUrl: "/store-assets/placeholder.svg",
    images: imageCandidates,
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
    searchAttributes: { light: item.light || item.iluminacao || item.luminosidade || '', environment: item.environment || item.ambiente_ideal || item.onde_deixar || '' },
    isAvailable: commercial.active,
    status: productStatus(item),
    stock: {
      tracked: stockControlEnabled,
      quantity: Math.max(0, commercial.stockQuantity - commercial.reservedQuantity),
    },
    saleUnit: {
      code: unit,
      label: item.saleUnit?.label || (unit === "UN" ? "unidade" : unit),
      minimum: commercial.saleUnit.minimum,
      increment: commercial.saleUnit.increment,
    },
    salesCount: Number(item.salesCount) || 0,
  };

  if (imageFileId) res.imageFileId = imageFileId;

  if (Object.keys(item.specifications).length) res.specifications = item.specifications;
  if (item.productInfo.sections.length) res.contentSections = item.productInfo.sections;
  for (const attribute of item.productInfo.attributes) res[attribute.key] = attribute.value;
  // Transitional API aliases derive from canonical values, never from a second source.
  const aliases = { careInstructions: 'care', cuidados_basicos: 'care', illumination: 'light', iluminacao: 'light',
    ambiente_ideal: 'environment', housing: 'environment', dicas_armazenamento: 'storageTips', durabilidade: 'durability', alimentacao: 'feeding' };
  for (const [alias, key] of Object.entries(aliases)) if (res[key]) res[alias] = res[key];

  return res;
}
function existingConfig(products, saved, settings = { stockControlEnabled: true }) {
  const activeProducts = products.filter(
    (p) => p.isAvailable && p.status !== "INATIVO",
  );
  if (saved?.config) {
    const result = structuredClone(saved.config);
    result.assistant ||= { enabled: false };
    result.assistant.mode ||= 'GUIDED';
    result.branding ||= {};
    result.branding.logoUrl ||= profile.branding.logoUrl;
    result.checkout ||= structuredClone(profile.checkout);
    result.checkout.pix = { ...result.checkout.pix, ...require('../orders/pix-mode').manualPixSettings({ required: false }) };
    result.categories ||= [];
    result.checkout.contactPhone ||=
      process.env.OWNER_WHATSAPP_NUMBER || "";
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

    if (result.checkout.delivery) result.checkout.delivery.label = "Entrega";
    if (result.checkout.pickup) result.checkout.pickup.label = "Retirada";
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
    ...require("../orders/pix-mode").manualPixSettings({ required: false }),
  };
  config.checkout.contactPhone =
    process.env.STORE_NOTIFICATION_PHONE || process.env.OWNER_WHATSAPP_NUMBER || "";
  config.checkout.enabledPayments = [];
  config.checkout.pickup.enabled = false;
  config.checkout.delivery = {
    enabled: false,
    label: "Entrega",
    serviceAreas: [],
    feeMinor: 0,
  };
  config.checkout.pickup.label = "Retirada";
  return config;
}
function installExistingStore(app, { repository, assistant, catalog, getOrderIntake = () => null }) {
  const { createPublicSnapshot } = require('./public-snapshot');
  const publicSnapshot = createPublicSnapshot(async () => {
    const [settings, saved, records] = await Promise.all([
      repository.getInventorySettings ? repository.getInventorySettings() : { stockControlEnabled: true },
      readSettings(),
      repository.getAllProducts(),
    ]);
    const items = await products({ settings, saved, records });
    const config = existingConfig(items, saved, settings);
    const visibleCategories = new Set(items.flatMap(item => item.categories));
    config.categories = config.categories.filter(category => category.isActive && visibleCategories.has(category.id));
    return { config, products: items };
  });
  if (app.locals) app.locals.publicCatalogCache = publicSnapshot;
  app.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
        /(?:product|stock|inventory|order|config|sale|reservation|webhook|tasks)/i.test(req.path)) {
      // Invalidating before AND after commit also covers a read racing the write.
      publicSnapshot.invalidate();
      res.once('finish', () => publicSnapshot.invalidate());
    }
    next();
  });
  const readSettings = async () => (await readStoreSettings(repository)) ?? null;
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
        config: existingConfig(await products({ saved }), saved),
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
  async function products({ advisory = false, settings, saved, records } = {}) {
    if (advisory && catalog) await catalog.refreshCatalog();
    records ||= advisory && Array.isArray(catalog?.rawItems) ? catalog.rawItems : await repository.getAllProducts();
    // Public browsing never depends on the store's complete sales history.
    // Personal purchase rankings have their own authenticated, on-demand flow.
    if (!settings && repository.getInventorySettings) {
      try {
        settings = await repository.getInventorySettings();
      } catch {
        settings = { stockControlEnabled: true };
      }
    }
    settings ||= { stockControlEnabled: true };
    if (saved === undefined) saved = await readSettings();
    return records
      .filter(item => !require('../catalog/commercial-product').isInternalFinancialProduct(item))
      .filter(require('../catalog/commercial-product').hasValidCommercialPrice)
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
  app.get("/api/storefront/catalog", async (req, res, next) => {
    try {
      const full = await publicSnapshot.read();
      const limit = Number.parseInt(req.query.limit, 10);
      const page = Number.parseInt(req.query.page, 10) || 1;
      const category = req.query.category ? String(req.query.category).trim().toLowerCase() : '';
      const search = req.query.search ? String(req.query.search).trim().toLowerCase() : '';

      if (!limit && !category && !search && !req.query.page) {
        return res.set("Cache-Control", "no-store").json(full);
      }

      let filteredProducts = full.products || [];
      if (category) {
        filteredProducts = filteredProducts.filter(p =>
          (p.categoryName && p.categoryName.toLowerCase().includes(category)) ||
          (Array.isArray(p.categories) && p.categories.some(c => String(c).toLowerCase() === category))
        );
      }
      if (search) {
        filteredProducts = filteredProducts.filter(p =>
          (p.name && p.name.toLowerCase().includes(search)) ||
          (p.canonicalName && p.canonicalName.toLowerCase().includes(search)) ||
          (Array.isArray(p.searchAliases) && p.searchAliases.some(a => String(a).toLowerCase().includes(search))) ||
          (Array.isArray(p.tags) && p.tags.some(t => String(t).toLowerCase().includes(search)))
        );
      }

      const totalItems = filteredProducts.length;
      if (limit && limit > 0) {
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
        return res.set("Cache-Control", "no-store").json({
          config: full.config,
          products: paginatedProducts,
          pagination: {
            page,
            limit,
            totalItems,
            totalPages: Math.ceil(totalItems / limit),
            hasMore: endIndex < totalItems,
          },
        });
      }

      return res.set("Cache-Control", "no-store").json({
        config: full.config,
        products: filteredProducts,
        pagination: { totalItems },
      });
    } catch (error) {
      next(error);
    }
  });
  app.post(["/api/storefront/assistant", "/api/chat"], async (req, res, next) => {
    try {
      const allItems = await products({ advisory: true });
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
      const intake = getOrderIntake();
      if (intake && req.user?.phone) {
        const result = await intake.handle({ phone: req.user.phone, customerName: req.user.name,
          message: req.body?.message, messageId: req.body?.requestId || '' });
        if (result) return res.json(req.path === '/api/chat' ? { reply: result.reply } : {
          message: result.reply, products: [], sources: [], mode: 'ORDER_REQUEST', needsConfirmation: result.intent !== 'ORDER_INTAKE_REGISTERED',
        });
      }
      const result = await assistant.recommend(
          config,
          saved?.assistant || {
            persona: "",
            instructions: "",
            webSearchEnabled: false,
          },
          items,
          req.body,
        );
      res.json(req.path === "/api/chat" ? { reply: result.message } : result);
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
      ensure(typeof data.price === 'number' && require('../catalog/commercial-product').hasValidCommercialPrice(data), 'Informe um preço válido, com até duas casas decimais.');
      const product = {
        id: data.id
          ? String(data.id)
          : `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: String(data.name).trim(),
        price: data.price,
        stockQuantity: Number(data.stockQuantity ?? data.stock ?? 0),
        status:
          String(data.status || "ATIVO").trim().toUpperCase() === "INATIVO"
            ? "INATIVO"
            : "ATIVO",
        unit: String(data.unit || "UN").trim().toUpperCase(),
        category: String(data.category || "Geral").trim(),
        subcategory: String(data.subcategory || "").trim(),
        description: String(data.description || "").trim(),
        ...(data.descriptionAi ? { descriptionAi: String(data.descriptionAi).trim(), descricao_ia: String(data.descriptionAi).trim() } : {}),
        ...(data.productType ? { productType: String(data.productType).trim() } : {}),
        ...(data.cuidados_basicos || data.careInstructions ? { cuidados_basicos: String(data.cuidados_basicos || data.careInstructions).trim(), careInstructions: String(data.careInstructions || data.cuidados_basicos).trim() } : {}),
        ...(data.ambiente_ideal ? { ambiente_ideal: String(data.ambiente_ideal).trim() } : {}),
        ...(data.housing ? { housing: String(data.housing).trim() } : {}),
        ...(data.iluminacao || data.illumination ? { iluminacao: String(data.iluminacao || data.illumination).trim(), illumination: String(data.illumination || data.iluminacao).trim() } : {}),
        ...(data.rega || data.watering ? { rega: String(data.rega || data.watering).trim(), watering: String(data.watering || data.rega).trim() } : {}),
        ...(data.alimentacao || data.feeding ? { alimentacao: String(data.alimentacao || data.feeding).trim(), feeding: String(data.feeding || data.alimentacao).trim() } : {}),
        ...(data.manejo || data.handling ? { manejo: String(data.manejo || data.handling).trim(), handling: String(data.handling || data.manejo).trim() } : {}),
        ...(data.alimentos_proibidos || data.prohibitedFoods ? { alimentos_proibidos: String(data.alimentos_proibidos || data.prohibitedFoods).trim(), prohibitedFoods: String(data.prohibitedFoods || data.alimentos_proibidos).trim() } : {}),
        ...(data.preferences ? { preferences: String(data.preferences).trim() } : {}),
        ...(data.dislikes ? { dislikes: String(data.dislikes).trim() } : {}),
        ...(data.dicas_armazenamento || data.storageTips ? { dicas_armazenamento: String(data.dicas_armazenamento || data.storageTips).trim(), storageTips: String(data.storageTips || data.dicas_armazenamento).trim() } : {}),
        ...(data.durabilidade || data.durability ? { durabilidade: String(data.durabilidade || data.durability).trim(), durability: String(data.durability || data.durabilidade).trim() } : {}),
        ...(data.usage ? { usage: String(data.usage).trim() } : {}),
        ...(data.suitability ? { suitability: String(data.suitability).trim() } : {}),
        ...(data.matureSize ? { matureSize: String(data.matureSize).trim() } : {}),
        ...(data.precautions ? { precautions: String(data.precautions).trim() } : {}),
        ...(data.selectionTips ? { selectionTips: String(data.selectionTips).trim() } : {}),
        ...(data.botanical && typeof data.botanical === "object" ? { botanical: data.botanical } : {}),
        ...(data.especificacoes && typeof data.especificacoes === "object" ? { especificacoes: data.especificacoes } : {}),
        ...(data.specifications && typeof data.specifications === "object" ? { specifications: data.specifications } : {}),
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
      product.publicDescription = product.description;
      product.contentProvenance = { kind: 'STAFF_CONFIRMED', confirmedBy: req.user.id, confirmedAt: new Date().toISOString(),
        fields: Object.keys(product).filter(field => [...require('../catalog/registered-product-content').detailFields, 'description', 'specifications', 'especificacoes'].includes(field)) };
      ensure(typeof repository.saveProduct === 'function', 'Cadastro de produtos indisponível.', 503);
      await repository.saveProduct(product);
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
      ensure(typeof repository.quickAddStock === 'function', 'Entrada de estoque indisponível.', 503);
      const result = await repository.quickAddStock(productId, qty);
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
        await repository.saveProduct({ id: existing.id, status: targetStatus });
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
    input.paymentMethod !== "FIADO" && (storeConfig.checkout.enabledPayments.includes(input.paymentMethod) || input.paymentMethod === "CARD"),
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
  const productIds = [...new Set(input.items.map(item => String(item?.productId || '')))];
  const currentProducts = repository.getProductsByIds
    ? await repository.getProductsByIds(productIds)
    : await repository.getAllProducts();
  const catalog = new Map(
    currentProducts.map((item) => [
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
      Number(((quantities.get(String(item.productId)) || 0) + item.quantity).toFixed(3)),
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
  let deliveryLocation = null;
  if (input.fulfillment === "delivery" && input.deliveryLocation && typeof input.deliveryLocation === "object") {
    const lat = Number(input.deliveryLocation.lat);
    const lng = Number(input.deliveryLocation.lng);
    if (input.deliveryLocation.lat !== null && input.deliveryLocation.lng !== null && input.deliveryLocation.lat !== '' && input.deliveryLocation.lng !== '' && Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      deliveryLocation = {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        reference: String(input.deliveryLocation.reference || "").trim().slice(0, 200),
        formattedAddress: String(input.deliveryLocation.formattedAddress || input.deliveryLocation.address || input.address || "").trim().slice(0, 300),
        placeId: String(input.deliveryLocation.placeId || "").trim().slice(0, 160),
        capturedVia: ["gps", "search", "pin"].includes(input.deliveryLocation.capturedVia) ? input.deliveryLocation.capturedVia : "pin",
      };
    }
  }
  req.body = {
    ...(/^[a-f0-9-]{36}$/.test(input.analyticsClientId || '') ? { analyticsClientId: input.analyticsClientId } : {}),
    customerName: String(input.customer?.name || "").trim(),
    customerPhone: String(input.customer?.phone || "").replace(/\D/g, ""),
    orderType: input.fulfillment === "delivery" ? "DELIVERY" : "PICKUP",
    deliveryAddress: input.address,
    ...(deliveryLocation ? { deliveryLocation } : {}),
    paymentMethod: { PIX: "PIX", CARD: "CARTAO", CASH: "DINHEIRO", CREDITO: "CREDITO", DEBITO: "DEBITO", FIADO: "FIADO" }[
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
  if (repository.firestore && repository._firestoreClientDisabled) {
    if (process.env.NODE_ENV !== 'test') {
      return repository.storefrontSettings;
    }
    throw Object.assign(new Error('Configurações da loja indisponíveis.'), { status: 503 });
  }
  if (repository.firestore && !repository._firestoreClientDisabled) {
    try {
      const snap = await repository.firestore
        .collection("store_settings")
        .doc("storefront")
        .get();
      return snap.data();
    } catch (err) {
      if (process.env.NODE_ENV !== 'test' && (err?.code === 7 || /PERMISSION_DENIED|insufficient permissions/i.test(err?.message || ''))) {
        repository._firestoreClientDisabled = true;
        return repository.storefrontSettings;
      }
      throw Object.assign(new Error('Configurações da loja indisponíveis.', { cause: err }), { status: 503 });
    }
  }
  if (process.env.NODE_ENV !== 'test') throw Object.assign(new Error('Configurações da loja indisponíveis.'), { status: 503 });
  return repository.storefrontSettings;
}
module.exports = {
  installExistingStore,
  normalizeExistingCheckout,
  toProduct,
  readStoreSettings,
  existingConfig,
};
