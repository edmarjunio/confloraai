const { randomUUID } = require("node:crypto");
const { ensure, identifier, digest } = require("./validation");

/** Every document is addressed through an explicit tenant. Production errors never fall back to memory. */
class StoreRepository {
  constructor({ firestore = null } = {}) {
    ensure(
      firestore || process.env.NODE_ENV !== "production",
      "Firestore obrigatório em produção.",
      503,
    );
    this.firestore = firestore;
    this.memory = new Map();
    this.locks = new Map();
  }
  path(tenantId, collection, id) {
    return `stores/${identifier(tenantId)}/${identifier(collection)}/${identifier(id)}`;
  }
  async get(tenantId, collection, id) {
    const path = this.path(tenantId, collection, id);
    return this.firestore
      ? (await this.firestore.doc(path).get()).data() || null
      : structuredClone(this.memory.get(path) || null);
  }
  async put(tenantId, collection, id, data) {
    const path = this.path(tenantId, collection, id);
    if (this.firestore) {
      await this.firestore.doc(path).set(data);
    } else {
      this.memory.set(path, structuredClone(data));
    }
    return data;
  }
  async list(tenantId, collection) {
    const prefix = `stores/${identifier(tenantId)}/${identifier(collection)}/`;
    if (this.firestore) {
      return (
        await this.firestore.collection(prefix.slice(0, -1)).get()
      ).docs.map((d) => ({ ...d.data(), id: d.id }));
    }
    return [...this.memory.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({
        ...structuredClone(value),
        id: key.slice(prefix.length),
      }));
  }
  async config(slug) {
    // Slug is the immutable tenant ID. There is no caller-controlled fallback tenant.
    return this.get(identifier(slug), "publicConfig", "current");
  }
  async atomic(tenantId, execute) {
    if (this.firestore) {
      return this.firestore.runTransaction(async (transaction) =>
        execute({
          get: async (collection, id) =>
            (
              await transaction.get(
                this.firestore.doc(this.path(tenantId, collection, id)),
              )
            ).data() || null,
          put: (collection, id, data) =>
            transaction.set(
              this.firestore.doc(this.path(tenantId, collection, id)),
              data,
            ),
        }),
      );
    }
    const previous = this.locks.get(tenantId) || Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(async () => {
        const changes = [];
        const result = await execute({
          get: (collection, id) => this.get(tenantId, collection, id),
          put: (collection, id, data) => changes.push([collection, id, data]),
        });
        for (const [collection, id, data] of changes) {
          await this.put(tenantId, collection, id, data);
        }
        return result;
      });
    this.locks.set(tenantId, next);
    try {
      return await next;
    } finally {
      if (this.locks.get(tenantId) === next) {
        this.locks.delete(tenantId);
      }
    }
  }
  async createOrder(tenantId, input, customerId, key) {
    const fingerprint = digest(JSON.stringify({ input, customerId }));
    const orderId = digest(`${customerId || "guest"}:${key}`);
    return this.atomic(tenantId, async (transaction) => {
      const existing = await transaction.get("orders", orderId);
      if (existing) {
        ensure(
          existing.fingerprint === fingerprint,
          "Pedido já enviado com outros dados.",
          409,
        );
        return existing;
      }
      const config = await transaction.get("publicConfig", "current");
      ensure(config, "Loja não encontrada.", 404);
      ensure(
        config.checkout.enabledPayments.includes(input.paymentMethod),
        "Pagamento indisponível.",
      );
      ensure(
        ["delivery", "pickup"].includes(input.fulfillment) &&
          config.checkout[input.fulfillment].enabled,
        "Logística indisponível.",
      );
      if (input.fulfillment === "delivery") {
        ensure(input.address.length >= 8, "Informe o endereço de entrega.");
        const areas = config.checkout.delivery.serviceAreas;
        ensure(
          !areas.length || areas.includes(input.serviceArea),
          "Selecione uma região atendida.",
        );
      }
      const items = [];
      const changes = [];
      for (const item of input.items) {
        const product = await transaction.get("products", item.productId);
        ensure(product?.isAvailable, "Produto indisponível.", 409);
        const quantity = item.quantity;
        const { minimum, increment } = product.saleUnit;
        ensure(
          quantity >= minimum &&
            Math.abs(
              (quantity - minimum) / increment -
                Math.round((quantity - minimum) / increment),
            ) < 0.00001,
          "Quantidade inválida.",
        );
        ensure(
          !product.stock.tracked || product.stock.quantity >= quantity,
          `Estoque insuficiente: ${product.name}.`,
          409,
        );
        const subtotalMinor = Math.round(product.price.amountMinor * quantity);
        ensure(Number.isSafeInteger(subtotalMinor), "Total inválido.");
        items.push({
          productId: product.id,
          name: product.name,
          quantity,
          priceMinor: product.price.amountMinor,
          subtotalMinor,
        });
        if (product.stock.tracked) {
          changes.push({
            ...product,
            revision: this.newId(),
            updatedAt: new Date().toISOString(),
            stock: {
              ...product.stock,
              quantity: Number((product.stock.quantity - quantity).toFixed(6)),
            },
          });
        }
      }
      const subtotalMinor = items.reduce(
        (sum, item) => sum + item.subtotalMinor,
        0,
      );
      const deliveryFeeMinor =
        input.fulfillment === "delivery"
          ? config.checkout.delivery.feeMinor
          : 0;
      ensure(
        Number.isSafeInteger(subtotalMinor + deliveryFeeMinor),
        "Total inválido.",
      );
      const order = {
        id: orderId,
        tenantId,
        customerId,
        customer: input.customer,
        address: input.address,
        serviceArea: input.serviceArea,
        fulfillment: input.fulfillment,
        paymentMethod: input.paymentMethod,
        items,
        subtotalMinor,
        deliveryFeeMinor,
        totalMinor: subtotalMinor + deliveryFeeMinor,
        cashTenderedMinor: input.cashTenderedMinor,
        status: "PENDING",
        paymentStatus: "PENDING",
        fingerprint,
        createdAt: new Date().toISOString(),
      };
      ensure(
        order.paymentMethod !== "CASH" ||
          !order.cashTenderedMinor ||
          order.cashTenderedMinor >= order.totalMinor,
        "Valor em dinheiro insuficiente.",
      );
      for (const product of changes) {
        transaction.put("products", product.id, product);
      }
      transaction.put("orders", orderId, order);
      transaction.put("outbox", orderId, {
        id: orderId,
        type: "ORDER_CREATED",
        orderId,
        status: "PENDING",
        createdAt: order.createdAt,
        attempts: 0,
      });
      return order;
    });
  }
  async updateOrder(tenantId, id, status) {
    ensure(
      ["CONFIRMED", "DELIVERED", "CANCELLED"].includes(status),
      "Status inválido.",
    );
    return this.atomic(tenantId, async (transaction) => {
      const order = await transaction.get("orders", identifier(id));
      ensure(order, "Pedido não encontrado.", 404);
      if (order.status === status) {
        return order;
      }
      const allowed = {
        PENDING: ["CONFIRMED", "CANCELLED"],
        CONFIRMED: ["DELIVERED", "CANCELLED"],
        DELIVERED: [],
        CANCELLED: [],
      };
      ensure(
        allowed[order.status].includes(status),
        "Transição de status inválida.",
        409,
      );
      const products = [];
      for (const item of order.items) {
        const product = await transaction.get("products", item.productId);
        if (!product) {
          continue;
        }
        if (status === "CANCELLED" && product.stock.tracked) {
          product.stock.quantity += item.quantity;
        }
        if (status === "CONFIRMED") {
          product.salesCount = (product.salesCount || 0) + item.quantity;
        }
        if (status === "CANCELLED" && order.status === "CONFIRMED") {
          product.salesCount = Math.max(
            0,
            (product.salesCount || 0) - item.quantity,
          );
        }
        products.push({
          ...product,
          revision: this.newId(),
          updatedAt: new Date().toISOString(),
        });
      }
      for (const product of products) {
        transaction.put("products", product.id, product);
      }
      const updated = { ...order, status, updatedAt: new Date().toISOString() };
      transaction.put("orders", id, updated);
      return updated;
    });
  }
  newId() {
    return randomUUID();
  }
}
module.exports = { StoreRepository };
