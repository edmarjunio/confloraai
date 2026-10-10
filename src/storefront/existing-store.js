const profile = require("../../config/stores/conflora.example.json");
const { rankProductSales } = require("../catalog/product-sales");
const { ensure, digest, StoreError } = require("./validation");

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
    isAvailable: String(item.status || "ATIVO").trim().toUpperCase() !== "INATIVO",
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
function existingConfig(products) {
  const config = structuredClone(profile);
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
      records = rankProductSales(records, await repository.getSalesOrders());
    }
    const settings = await repository.getInventorySettings();
    return records.map((item) => toProduct(item, settings)).filter((p) => p.isAvailable);
  }
  app.get("/api/storefront/catalog", async (_req, res, next) => {
    try {
      const items = await products();
      res
        .set("Cache-Control", "no-store")
        .json({ config: existingConfig(items), products: items });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/storefront/assistant", async (req, res, next) => {
    try {
      const items = await products();
      res.json(
        await assistant.recommend(
          existingConfig(items),
          { persona: "", instructions: "", webSearchEnabled: true },
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
    ["PIX", "CARD", "CASH"].includes(input.paymentMethod),
    "Pagamento inválido.",
  );
  ensure(
    input.fulfillment !== "delivery" ||
      (input.serviceArea === "Mineiros - GO" &&
        String(input.address || "").trim().length >= 5),
    "Informe o endereço de entrega em Mineiros - GO.",
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
      product?.isAvailable && (!product.stock.tracked || product.stock.quantity >= quantity),
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
    subtotal: total,
    discount: 0,
    changeDue: Math.max(0, Number(input.cashTenderedMinor || 0) / 100 - total),
  };
}
module.exports = { installExistingStore, normalizeExistingCheckout, toProduct };
