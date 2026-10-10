const { createHash, randomUUID } = require("node:crypto");

class StoreError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
function ensure(condition, message, status = 400) {
  if (!condition) {
    throw new StoreError(message, status);
  }
}
function text(value, max = 500, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  ensure(
    result.length <= max && (!required || result.length > 0),
    "Texto inválido ou obrigatório.",
  );
  return result;
}
function identifier(value) {
  ensure(
    typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value),
    "Identificador inválido.",
  );
  return value;
}
function imageUrl(value, tenantId = "") {
  const url = text(value, 2000);
  const tenantImage =
    tenantId &&
    url.startsWith(`/api/stores/${tenantId}/images/`) &&
    /^[a-zA-Z0-9_-]+$/.test(url.split("/").pop());
  ensure(
    !url ||
      /^https:\/\/[^\s]+$/i.test(url) ||
      /^\/store-assets\/[a-zA-Z0-9._/-]+$/.test(url) ||
      tenantImage,
    "Use uma URL HTTPS para a imagem.",
  );
  return url;
}
function nonNegative(value, integer = false) {
  ensure(
    typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      (!integer || Number.isSafeInteger(value)),
    "Valor numérico inválido.",
  );
  return value;
}
function validateConfig(input, tenantId) {
  ensure(input && typeof input === "object", "Configuração inválida.");
  const identity = input.identity || {};
  const colors = input.branding?.colors || {};
  for (const key of ["primary", "accent", "text", "background"]) {
    ensure(
      /^#[0-9a-f]{6}$/i.test(colors[key]),
      "Informe cores no formato #RRGGBB.",
    );
  }
  const checkout = input.checkout || {};
  const payments = checkout.enabledPayments;
  ensure(
    Array.isArray(payments) &&
      payments.length > 0 &&
      payments.every((p) => ["PIX", "CARD", "CASH"].includes(p)),
    "Selecione formas de pagamento válidas.",
  );
  ensure(
    checkout.delivery?.enabled || checkout.pickup?.enabled,
    "Habilite entrega ou retirada.",
  );
  ensure(
    ["IN_APP", "WHATSAPP_HANDOFF"].includes(checkout.completionMode),
    "Modo de fechamento inválido.",
  );
  const phone = text(checkout.contactPhone, 20);
  ensure(
    !phone || /^\d{10,15}$/.test(phone),
    "WhatsApp deve conter apenas números com código do país.",
  );
  ensure(
    checkout.completionMode !== "WHATSAPP_HANDOFF" || phone,
    "Configure o WhatsApp da loja.",
  );
  const categories = (input.categories || []).map((category, index) => ({
    id: identifier(category.id),
    name: text(category.name, 80, true),
    order: index,
    isActive: category.isActive !== false,
  }));
  ensure(
    categories.length <= 100 &&
      new Set(categories.map((c) => c.id)).size === categories.length,
    "Categorias duplicadas ou em excesso.",
  );
  const pixKey = text(checkout.pix?.key, 140);
  ensure(
    !payments.includes("PIX") || pixKey,
    "Configure a chave PIX antes de habilitar PIX.",
  );
  return {
    tenantId,
    slug: identifier(input.slug),
    version: 1,
    identity: {
      name: text(identity.name, 100, true),
      subtitle: text(identity.subtitle, 160),
      niche: text(identity.niche, 100, true),
      city: text(identity.city, 100),
      region: text(identity.region, 100),
      locale: "pt-BR",
      currency: "BRL",
    },
    branding: {
      logoUrl: imageUrl(input.branding?.logoUrl),
      iconUrl: imageUrl(input.branding?.iconUrl),
      colors: Object.fromEntries(
        ["primary", "accent", "text", "background"].map((k) => [k, colors[k]]),
      ),
    },
    categories,
    checkout: {
      enabledPayments: [...new Set(payments)],
      pix: {
        key: pixKey,
        recipientName: text(checkout.pix?.recipientName, 100),
      },
      contactPhone: phone,
      completionMode: checkout.completionMode,
      delivery: {
        enabled: !!checkout.delivery?.enabled,
        label: text(checkout.delivery?.label, 100) || "Entrega",
        serviceAreas: (checkout.delivery?.serviceAreas || []).map((a) =>
          text(a, 100),
        ),
        feeMinor: nonNegative(checkout.delivery?.feeMinor || 0, true),
      },
      pickup: {
        enabled: !!checkout.pickup?.enabled,
        label: text(checkout.pickup?.label, 100) || "Retirada no local",
        address: text(checkout.pickup?.address, 300),
      },
    },
    assistant: {
      enabled: !!input.assistant?.enabled,
      displayName: text(input.assistant?.displayName, 100) || "Assistente",
      welcomeMessage:
        text(input.assistant?.welcomeMessage, 500) || "Como posso ajudar?",
      suggestedQuestions: (input.assistant?.suggestedQuestions || [])
        .slice(0, 5)
        .map((q) => text(q, 150)),
    },
  };
}
function validateProduct(input, tenantId, config) {
  ensure(input && typeof input === "object", "Produto inválido.");
  const categories = [...new Set(input.categories || [])];
  ensure(
    categories.every((id) => config.categories.some((c) => c.id === id)),
    "Categoria não cadastrada.",
  );
  const specifications = {};
  for (const [key, attribute] of Object.entries(
    input.specifications || {},
  ).slice(0, 50)) {
    identifier(key);
    specifications[key] = {
      label: text(attribute.label, 100, true),
      value: text(String(attribute.value ?? ""), 500),
      unit: text(attribute.unit, 20),
    };
  }
  const minimum = nonNegative(input.saleUnit?.minimum ?? 1);
  const increment = nonNegative(input.saleUnit?.increment ?? 1);
  ensure(
    minimum > 0 && increment > 0,
    "Quantidade mínima e incremento devem ser positivos.",
  );
  return {
    tenantId,
    id: identifier(input.id),
    slug: identifier(input.slug || input.id),
    name: text(input.name, 150, true),
    description: text(input.description, 5000),
    price: {
      amountMinor: nonNegative(input.price?.amountMinor, true),
      currency: config.identity.currency,
    },
    imageUrl: imageUrl(input.imageUrl, tenantId),
    images: (input.images || [])
      .slice(0, 10)
      .map((i) => ({ url: imageUrl(i.url, tenantId), alt: text(i.alt, 150) })),
    categories,
    tags: (input.tags || []).slice(0, 30).map((t) => text(t, 100)),
    specifications,
    contentSections: (input.contentSections || [])
      .slice(0, 15)
      .map((s) => ({
        id: identifier(s.id),
        title: text(s.title, 100, true),
        body: text(s.body, 5000),
      })),
    isAvailable: input.isAvailable !== false,
    stock: {
      tracked: !!input.stock?.tracked,
      quantity: nonNegative(input.stock?.quantity || 0),
    },
    saleUnit: {
      code: text(input.saleUnit?.code, 10) || "UN",
      label: text(input.saleUnit?.label, 30) || "unidade",
      minimum,
      increment,
    },
    updatedAt: new Date().toISOString(),
    revision: randomUUID(),
  };
}
const digest = (value) => createHash("sha256").update(value).digest("hex");
module.exports = {
  StoreError,
  ensure,
  text,
  identifier,
  validateConfig,
  validateProduct,
  digest,
};
