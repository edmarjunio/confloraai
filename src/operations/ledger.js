const { t } = require("../i18n");
const { randomUUID, createHash } = require("node:crypto");
function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    fail(t("interface.message.fe888f219977"));
  }
  return Math.round(n * 100);
}
function quantity(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    fail(t("validation.quantityPositive"));
  }
  return n;
}
function key(value) {
  if (!/^[a-zA-Z0-9_-]{8,120}$/.test(value || "")) {
    fail(t("interface.message.84ee9afa224d"));
  }
  return value;
}
class Ledger {
  constructor(repo) {
    this.repo = repo;
  }
  get db() {
    if (!this.repo.firestore) {
      fail(t("interface.message.fd01dc770501"), 503);
    }
    return this.repo.firestore;
  }
  async execute(requestId, actor, action) {
    const ref = this.db.collection("operation_requests").doc(key(requestId));
    return this.db.runTransaction(async (tx) => {
      const catalog = await require("../import/product-catalog").catalogState(
        this.db,
        tx,
      );
      tx.productCollectionPath = catalog.collectionPath;
      const previous = await tx.get(ref);
      if (previous.exists) {
        if (previous.data().actorId !== actor.id) {
          fail(t("interface.message.33c1bcadd838"), 403);
        }
        return previous.data().result;
      }
      const result = await action(tx);
      tx.create(ref, {
        actorId: actor.id,
        result,
        createdAt: new Date().toISOString(),
      });
      return result;
    });
  }
  movement(tx, productRef, product, delta, details, actor) {
    const before = Number(product.stockQuantity ?? product.estoque ?? 0);
    const after = before + delta;
    const version = Number(product.stockVersion || 0) + 1;
    const now = new Date().toISOString();
    tx.update(productRef, {
      stockQuantity: after,
      estoque: after,
      stockVersion: version,
      updatedAt: now,
    });
    const record = {
      id: randomUUID(),
      productId: productRef.id,
      productName: product.name || product.descricao || "",
      previousStock: before,
      newStock: after,
      delta,
      actorId: actor.id,
      actorName: actor.name,
      createdAt: now,
      ...details,
    };
    tx.create(this.db.collection("stock_movements").doc(record.id), record);
    // Uma pendência por produto; atualizada enquanto o saldo continuar negativo.
    tx.set(this.db.collection("stock_discrepancies").doc(productRef.id), {
      productId: productRef.id,
      productName: record.productName,
      balance: after,
      status: after < 0 ? "OPEN" : "RESOLVED",
      updatedAt: now,
      actorId: actor.id,
    });
    return record;
  }
  creditMovement(tx, customerRef, customer, deltaCents, details, actor) {
    const previousBalanceCents = Number(customer.balanceCents || 0);
    const balanceCents = previousBalanceCents + deltaCents;
    if (!Number.isSafeInteger(balanceCents) || balanceCents < 0) {
      fail(t("interface.message.24a32595fea6"));
    }
    const now = new Date().toISOString();
    tx.update(customerRef, { balanceCents, updatedAt: now });
    const id = randomUUID();
    tx.create(this.db.collection("credit_movements").doc(id), {
      id,
      customerId: customerRef.id,
      customerName: customer.name,
      deltaCents,
      previousBalanceCents,
      balanceCents,
      actorId: actor.id,
      actorName: actor.name,
      createdAt: now,
      ...details,
    });
    return balanceCents;
  }
  async createCreditCustomer(input, actor) {
    const name = String(input.name || "").trim();
    if (!name || name.length > 200) {
      fail(t("interface.message.75926a3ca1ef"));
    }
    return this.execute(input.requestId, actor, async (tx) => {
      const customer = {
        id: randomUUID(),
        name,
        phone: String(input.phone || "").trim(),
        balanceCents: 0,
        createdAt: new Date().toISOString(),
        createdBy: actor.id,
      };
      tx.create(
        this.db.collection("credit_customers").doc(customer.id),
        customer,
      );
      return customer;
    });
  }
  async receiveCredit(input, actor) {
    const amountCents = money(input.amount);
    if (!amountCents) {
      fail(t("interface.message.3063f77694ec"));
    }
    return this.execute(input.requestId, actor, async (tx) => {
      const customerRef = this.db
        .collection("credit_customers")
        .doc(String(input.customerId));
      const customerSnap = await tx.get(customerRef);
      if (!customerSnap.exists) {
        fail(t("interface.message.77f22078da1b"));
      }
      const customer = customerSnap.data();
      if (amountCents > Number(customer.balanceCents || 0)) {
        fail(t("validation.receiptExceedsDebt"));
      }
      const snapshot = await tx.get(
        this.db
          .collection("orders")
          .where("creditCustomerId", "==", customerRef.id),
      );
      const orders = snapshot.docs
        .filter(
          (d) =>
            d.data().status !== "CANCELLED" &&
            !d.data().historical &&
            money(d.data().total) > money(d.data().paidAmount || 0),
        )
        .sort(
          (a, b) =>
            String(a.data().createdAt).localeCompare(
              String(b.data().createdAt),
            ) || a.id.localeCompare(b.id),
        );
      const openCents = orders.reduce(
        (sum, d) =>
          sum + money(d.data().total) - money(d.data().paidAmount || 0),
        0,
      );
      if (openCents !== Number(customer.balanceCents || 0)) {
        fail(t("interface.message.9c9e70e2d0f3"), 409);
      }
      let remaining = amountCents;
      const allocations = [];
      for (const doc of orders) {
        if (!remaining) {
          break;
        }
        const order = doc.data();
        const applied = Math.min(
          remaining,
          money(order.total) - money(order.paidAmount || 0),
        );
        const paidCents = money(order.paidAmount || 0) + applied;
        remaining -= applied;
        tx.update(this.db.collection("orders").doc(doc.id), {
          paidAmount: paidCents / 100,
          paymentStatus:
            paidCents === money(order.total) ? "RECEBIDO" : "A RECEBER",
        });
        allocations.push({ orderId: doc.id, amount: applied / 100 });
      }
      const receipt = {
        id: randomUUID(),
        businessDate: require("./cash-report").businessDay(),
        customerId: customerRef.id,
        customerName: customer.name,
        amount: amountCents / 100,
        allocations,
        paymentMethod: input.paymentMethod || "PIX",
        actorId: actor.id,
        actorName: actor.name,
        createdAt: new Date().toISOString(),
      };
      const balanceCents = this.creditMovement(
        tx,
        customerRef,
        customer,
        -amountCents,
        { type: "RECEIPT", receiptId: receipt.id },
        actor,
      );
      tx.create(this.db.collection("receipts").doc(receipt.id), receipt);
      return { ...receipt, balance: balanceCents / 100 };
    });
  }
  async cash(input, actor) {
    if (!["OPENING", "WITHDRAWAL", "EXPENSE", "REFUND"].includes(input.type)) {
      fail(t("interface.message.cc8f294d7212"));
    }
    const amountCents = money(input.amount);
    if (input.type !== "OPENING" && !amountCents) {
      fail(t("interface.message.2099645dc4d7"));
    }
    if (!String(input.reason || "").trim()) {
      fail(t("interface.message.f561466f73ce"));
    }
    return this.execute(input.requestId, actor, async (tx) => {
      const day = require("./cash-report").businessDay();
      if (input.type === "OPENING") {
        const ref = this.db.collection("cash_openings").doc(day);
        const existing = await tx.get(ref);
        if (existing.exists) {
          fail(t("interface.message.54cac0f8226f"), 409);
        }
        // Abertura importada e abertura nova não podem coexistir no mesmo dia.
        const imported = await tx.get(
          this.db.collection("cash_movements").where("businessDate", "==", day),
        );
        if (
          imported.docs.some(
            (d) =>
              d.data().type === "OPENING" ||
              String(d.data().raw?.CATEGORIA || "")
                .toUpperCase()
                .includes(t("interface.message.d0878c96c643")),
          )
        ) {
          fail(t("interface.message.168b28750fee"), 409);
        }
        tx.create(ref, {
          businessDate: day,
          amount: amountCents / 100,
          actorId: actor.id,
        });
      }
      const movement = {
        id: randomUUID(),
        type: input.type,
        amount: amountCents / 100,
        paymentMethod: "DINHEIRO",
        businessDate: day,
        actorId: actor.id,
        actorName: actor.name,
        reason: input.reason.trim(),
        createdAt: new Date().toISOString(),
      };
      tx.create(
        this.db.collection("cash_movements").doc(movement.id),
        movement,
      );
      return movement;
    });
  }
  async stock(input, actor) {
    const type = input.type;
    if (!["ENTRY", "LOSS", "COUNT"].includes(type)) {
      fail(t("interface.message.13075022b08b"));
    }
    if (type === "COUNT" && actor.role !== "ADMIN") {
      fail(t("validation.adminCountOnly"), 403);
    }
    if (!input.reason?.trim()) {
      fail(t("interface.message.0e42451d2028"));
    }
    return this.execute(input.requestId, actor, async (tx) => {
      const ref = this.db
        .collection(tx.productCollectionPath || "products")
        .doc(String(input.productId));
      const snap = await tx.get(ref);
      if (!snap.exists) {
        fail(t("interface.message.9f5a2fd4316b"));
      }
      const p = snap.data();
      let delta;
      if (type === "COUNT") {
        if (Number(input.expectedVersion) !== Number(p.stockVersion || 0)) {
          fail(t("interface.message.435d91b19b10"), 409);
        }
        const counted = Number(input.quantity);
        if (!Number.isFinite(counted) || counted < 0) {
          fail(t("interface.message.e90d99844248"));
        }
        delta = counted - Number(p.stockQuantity ?? p.estoque ?? 0);
      } else {
        delta = quantity(input.quantity) * (type === "LOSS" ? -1 : 1);
      }
      const suppliedCost =
        type === "ENTRY" &&
        input.unitCost !== undefined &&
        input.unitCost !== null &&
        input.unitCost !== "";
      const unitCost = suppliedCost ? money(input.unitCost) / 100 : null;
      if (suppliedCost) {
        tx.update(ref, {
          unitCost,
          costBasis: "LAST_INFORMED_ENTRY",
          costUpdatedAt: new Date().toISOString(),
        });
      }
      return this.movement(
        tx,
        ref,
        p,
        delta,
        {
          type,
          reason: input.reason.trim(),
          unitCost,
          totalCost: suppliedCost
            ? Math.round(unitCost * Math.abs(delta) * 100) / 100
            : null,
        },
        actor,
      );
    });
  }
  async sale(input, actor) {
    if (
      !Array.isArray(input.items) ||
      !input.items.length ||
      input.items.length > 100
    ) {
      fail(t("interface.message.8b2c98c7c51a"));
    }
    return this.execute(input.requestId, actor, async (tx) => {
      const aggregated = new Map();
      for (const item of input.items) {
        aggregated.set(
          String(item.productId),
          (aggregated.get(String(item.productId)) || 0) +
            quantity(item.quantity),
        );
      }
      const refs = [...aggregated.keys()].map((id) =>
        this.db.collection(tx.productCollectionPath || "products").doc(id),
      );
      const snaps = await tx.getAll(...refs);
      const creditSale =
        input.paymentMethod === "A RECEBER" || Boolean(input.creditCustomerId);
      let creditCustomerRef = null,
        creditCustomer = null;
      if (creditSale) {
        if (!input.creditCustomerId) {
          fail(t("credit.selectCustomer"));
        }
        creditCustomerRef = this.db
          .collection("credit_customers")
          .doc(String(input.creditCustomerId));
        const snap = await tx.get(creditCustomerRef);
        if (!snap.exists) {
          fail(t("interface.message.a534787676d2"));
        }
        creditCustomer = snap.data();
      }

      let subtotal = 0;
      const items = snaps.map((snap, i) => {
        if (!snap.exists) {
          fail(t("interface.message.9f5a2fd4316b"));
        }
        const p = snap.data();
        if (p.status === "INATIVO") {
          fail(t("interface.message.4f184974cb03"));
        }
        const priceCents = money(p.price ?? p.valor_num ?? p.VALOR);
        const qty = aggregated.get(refs[i].id);
        const itemTotal = Math.round(priceCents * qty);
        subtotal += itemTotal;
        return {
          id: randomUUID(),
          productId: refs[i].id,
          name: p.name || p.descricao || "",
          quantity: qty,
          price: priceCents / 100,
          subtotal: itemTotal / 100,
          unit: p.unit || "UN",
          unitCost:
            p.unitCost === undefined || p.unitCost === null
              ? null
              : money(p.unitCost) / 100,
          costBasis: p.costBasis || null,
        };
      });
      const discount = money(input.discount || 0);
      if (discount * 5 > subtotal) {
        fail(t("validation.discountLimit"));
      }
      const insufficient = snaps.filter(
        (s, i) =>
          Number(s.data().stockQuantity ?? s.data().estoque ?? 0) <
          items[i].quantity,
      );
      if (insufficient.length && input.confirmNegative !== true) {
        fail(t("interface.message.97acd7792482"), 409);
      }
      // Rateio só para calcular lucro líquido estimado: não modifica preço ou subtotal do item.
      let allocatedDiscount = 0;
      items.forEach((item, i) => {
        const itemDiscount =
          i === items.length - 1
            ? discount - allocatedDiscount
            : subtotal
              ? Math.floor((discount * money(item.subtotal)) / subtotal)
              : 0;
        allocatedDiscount += itemDiscount;
        item.discountAllocation = itemDiscount / 100;
        item.netRevenue = (money(item.subtotal) - itemDiscount) / 100;
        item.estimatedProfit =
          item.unitCost === null
            ? null
            : Math.round(
                (item.netRevenue - item.unitCost * item.quantity) * 100,
              ) / 100;
        item.markupPercent =
          item.unitCost === null || item.unitCost * item.quantity === 0
            ? null
            : (item.estimatedProfit * 100) / (item.unitCost * item.quantity);
        item.profitPercent =
          item.unitCost === null || item.netRevenue <= 0
            ? null
            : (item.estimatedProfit * 100) / item.netRevenue;
      });
      const now = new Date().toISOString();
      const order = {
        businessDate: require("./cash-report").businessDay(now),
        id: randomUUID(),
        items,
        subtotal: subtotal / 100,
        discount: discount / 100,
        discountPercent: subtotal ? (discount * 100) / subtotal : 0,
        deliveryFee: money(input.deliveryFee || 0) / 100,
        total: (subtotal - discount + money(input.deliveryFee || 0)) / 100,
        customerName:
          creditCustomer?.name ||
          input.customerName ||
          t("interface.message.c2b1bad0c6b3"),
        customerPhone: input.customerPhone || "",
        paymentMethod: input.paymentMethod || "DINHEIRO",
        status: "CONFIRMED",
        paymentStatus: input.onAccount || creditSale ? "A RECEBER" : "RECEBIDO",
        paidAmount:
          input.onAccount || creditSale
            ? 0
            : (subtotal - discount + money(input.deliveryFee || 0)) / 100,
        actorId: actor.id,
        actorName: actor.name,
        source: input.source || "CAIXA_MANUAL",
        orderType: input.orderType || "PICKUP",
        deliveryAddress: input.deliveryAddress || "",
        customerId: input.customerId || "",
        customerEmail: input.customerEmail || "",
        creditCustomerId: creditCustomerRef?.id || "",
        stockDeducted: true,
        createdAt: now,
        updatedAt: now,
      };
      order.initialPaidAmount = order.paidAmount;
      if (creditSale) {
        this.creditMovement(
          tx,
          creditCustomerRef,
          creditCustomer,
          money(order.total),
          { type: "SALE", orderId: order.id },
          actor,
        );
      }
      tx.create(this.db.collection("orders").doc(order.id), order);
      snaps.forEach((s, i) =>
        this.movement(
          tx,
          refs[i],
          s.data(),
          -items[i].quantity,
          { type: "SALE", orderId: order.id },
          actor,
        ),
      );
      if (discount * 20 > subtotal) {
        const id = randomUUID();
        tx.create(this.db.collection("notifications").doc(id), {
          id,
          toRole: "ADMIN",
          type: "DISCOUNT",
          orderId: order.id,
          title: t("interface.message.3cdecc3ffede"),
          message: `${actor.name}: R$ ${order.discount} (${order.discountPercent.toFixed(2)}%)`,
          actorId: actor.id,
          read: false,
          createdAt: now,
        });
      }
      return order;
    });
  }
  async cancel(input, actor) {
    if (actor.role !== "ADMIN") {
      fail(t("interface.message.a8d5f6d55653"), 403);
    }
    if (!input.reason?.trim()) {
      fail(t("interface.message.efc55df645cd"));
    }
    return this.execute(input.requestId, actor, async (tx) => {
      const ref = this.db.collection("orders").doc(String(input.orderId));
      const snap = await tx.get(ref);
      if (!snap.exists) {
        fail(t("interface.message.15298cab0f58"));
      }
      const order = snap.data();
      if (order.status === "CANCELLED") {
        return { id: ref.id, status: "CANCELLED" };
      }
      const items =
        order.stockDeducted && !order.historical ? order.items || [] : [];
      const refs = items.map((it) =>
        this.db
          .collection(tx.productCollectionPath || "products")
          .doc(it.productId),
      );
      const products = refs.length ? await tx.getAll(...refs) : [];
      products.forEach((p) => {
        if (!p.exists) {
          fail(t("interface.message.22410583c7e6"));
        }
      });
      let creditCustomerRef = null,
        creditCustomer = null;
      if (order.creditCustomerId) {
        creditCustomerRef = this.db
          .collection("credit_customers")
          .doc(order.creditCustomerId);
        const snap = await tx.get(creditCustomerRef);
        if (!snap.exists) {
          fail(t("interface.message.a534787676d2"));
        }
        creditCustomer = snap.data();
      }
      if (creditCustomerRef) {
        this.creditMovement(
          tx,
          creditCustomerRef,
          creditCustomer,
          -(money(order.total) - money(order.paidAmount || 0)),
          { type: "CANCELLATION", orderId: ref.id, reason: input.reason },
          actor,
        );
      }
      products.forEach((p, i) =>
        this.movement(
          tx,
          refs[i],
          p.data(),
          items[i].quantity,
          { type: "CANCELLATION", orderId: ref.id, reason: input.reason },
          actor,
        ),
      );
      tx.update(ref, {
        status: "CANCELLED",
        cancelledAt: new Date().toISOString(),
        cancelledBy: actor.id,
        cancellationReason: input.reason,
        refundRequired: money(order.paidAmount || 0) > 0,
      });
      return { id: ref.id, status: "CANCELLED" };
    });
  }
  async receive(input, actor) {
    const cents = money(input.amount);
    if (!cents) {
      fail(t("interface.message.3063f77694ec"));
    }
    return this.execute(input.requestId, actor, async (tx) => {
      const ref = this.db.collection("orders").doc(String(input.orderId));
      const snap = await tx.get(ref);
      if (!snap.exists) {
        fail(t("interface.message.15298cab0f58"));
      }
      const order = snap.data();
      if (order.status === "CANCELLED") {
        fail(t("interface.message.8cac9da517d3"));
      }
      if (order.historical && order.receivablesReconciled !== true) {
        fail(t("interface.message.81ae9a61a391"));
      }
      const paid = money(order.paidAmount || 0) + cents;
      if (paid > money(order.total)) {
        fail(t("interface.message.ba5364dbb4a1"));
      }
      let creditCustomerRef = null,
        creditCustomer = null;
      if (order.creditCustomerId) {
        creditCustomerRef = this.db
          .collection("credit_customers")
          .doc(order.creditCustomerId);
        const snap = await tx.get(creditCustomerRef);
        if (!snap.exists) {
          fail(t("interface.message.a534787676d2"));
        }
        creditCustomer = snap.data();
        if (cents > Number(creditCustomer.balanceCents || 0)) {
          fail(t("validation.receiptExceedsDebt"));
        }
      }
      const receipt = {
        id: randomUUID(),
        businessDate: require("./cash-report").businessDay(),
        customerId: order.creditCustomerId || "",
        orderId: ref.id,
        amount: cents / 100,
        paymentMethod: input.paymentMethod || "PIX",
        actorId: actor.id,
        createdAt: new Date().toISOString(),
      };
      if (creditCustomerRef) {
        this.creditMovement(
          tx,
          creditCustomerRef,
          creditCustomer,
          -cents,
          { type: "RECEIPT", receiptId: receipt.id, orderId: ref.id },
          actor,
        );
      }
      tx.create(this.db.collection("receipts").doc(receipt.id), receipt);
      tx.update(ref, {
        paidAmount: paid / 100,
        paymentStatus: paid === money(order.total) ? "RECEBIDO" : "A RECEBER",
      });
      return receipt;
    });
  }
}
module.exports = {
  Ledger,
  money,
  quantity,
  fail,
  key,
  hash: (value) => createHash("sha256").update(value).digest("hex"),
};
