import {
  $,
  element,
  money,
  notify,
  storageGet,
  storageSet,
  openDialog,
  copyText,
  quantityControl,
} from "./ui.js";
import { icon } from "./icons.js";

export function createCart(state) {
  const key = `store:${state.slug}:cart:v1`;
  const stored = storageGet(key, []);
  let items = Array.isArray(stored)
    ? stored.filter(
        (i) =>
          typeof i.productId === "string" &&
          Number.isFinite(i.quantity) &&
          i.quantity > 0,
      )
    : [];
  let sending = false;
  let pending = storageGet(`${key}:pending`, null);
  const form = $("#checkoutForm");
  const productFor = (item) =>
    state.products.find((p) => p.id === item.productId);
  const subtotal = () =>
    items.reduce(
      (sum, item) =>
        sum +
        Math.round((productFor(item)?.price.amountMinor || 0) * item.quantity),
      0,
    );
  function persist() {
    storageSet(key, items);
  }
  function add(product, quantity) {
    const steps =
      (quantity - product.saleUnit.minimum) / product.saleUnit.increment;
    if (
      !Number.isFinite(quantity) ||
      quantity < product.saleUnit.minimum ||
      Math.abs(steps - Math.round(steps)) > 0.00001
    ) {
      notify("Confira a quantidade e a unidade de venda.");
      return;
    }
    const current = items.find((i) => i.productId === product.id);
    const next = Number(((current?.quantity || 0) + quantity).toFixed(6));
    if (
      !product.isAvailable ||
      (product.stock.tracked && product.stock.quantity < next)
    ) {
      notify("Quantidade indisponível no estoque.");
      return;
    }
    if (current) {
      current.quantity = next;
    } else {
      items.push({ productId: product.id, quantity });
    }
    persist();
    render();
    notify(`${product.name} adicionado à sacola.`);
    if (
      window.matchMedia("(min-width:1100px)").matches &&
      !document.querySelector("dialog:modal")
    ) {
      open();
    }
  }
  function render() {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    $("#cartCount").textContent = $("#mobileCount").textContent = Number(
      count.toFixed(3),
    ).toLocaleString("pt-BR");
    $("#cartTitle").textContent = `Sua sacola (${items.length})`;
    $("#cartTotal").textContent = $("#mobileTotal").textContent =
      money(subtotal());
    $("#cartItems").replaceChildren(
      ...items.map((item) => {
        const product = productFor(item);
        const remove = () => {
          items = items.filter((i) => i !== item);
          persist();
          render();
        };
        const quantity = element("input", {
          type: "number",
          min: product?.saleUnit.minimum || 1,
          step: product?.saleUnit.increment || 1,
          value: item.quantity,
          "aria-label": `Quantidade de ${product?.name || "produto"}`,
        });
        quantity.addEventListener("change", () => {
          const value = Number(quantity.value);
          if (
            !product ||
            value < product.saleUnit.minimum ||
            !Number.isFinite(value) ||
            (product.stock.tracked && value > product.stock.quantity) ||
            Math.abs(
              value / product.saleUnit.increment -
                Math.round(value / product.saleUnit.increment),
            ) > 0.00001
          ) {
            render();
            return;
          }
          item.quantity = value;
          persist();
          render();
        });
        return element("article", { class: "cart-item" }, [
          element("img", {
            src: product?.imageUrl || "/store-assets/placeholder.svg",
            alt: "",
          }),
          element("div", {}, [
            element("strong", {
              text: product?.name || "Produto indisponível",
            }),
            element("span", {
              text: money((product?.price.amountMinor || 0) * item.quantity),
            }),
            quantityControl(quantity),
          ]),
          element(
            "button",
            {
              class: "quiet",
              "aria-label": `Remover ${product?.name || "produto"}`,
              onclick: remove,
            },
            [icon("trash")],
          ),
        ]);
      }),
    );
    if (!items.length) {
      $("#cartItems").append(
        element("p", {
          class: "empty",
          text: "Sua sacola está vazia. Escolha um produto para começar.",
        }),
      );
    }
    updateCheckout();
  }
  function choices(container, name, options) {
    container.replaceChildren(
      ...options.map((option, index) => {
        const input = element("input", {
          type: "radio",
          name,
          value: option.value,
          required: "",
        });
        input.checked = index === 0;
        return element("label", {}, [
          input,
          icon(
            {
              delivery: "truck",
              pickup: "store",
              PIX: "pix",
              CARD: "card",
              CASH: "cash",
            }[option.value],
          ),
          element("span", { text: option.label }),
        ]);
      }),
    );
  }
  function configure() {
    const checkout = state.config.checkout;
    choices(
      $("#fulfillmentOptions"),
      "fulfillment",
      ["delivery", "pickup"]
        .filter((type) => checkout[type].enabled)
        .map((type) => ({ value: type, label: checkout[type].label })),
    );
    choices(
      $("#paymentOptions"),
      "payment",
      checkout.enabledPayments.map((value) => ({
        value,
        label: { PIX: "PIX", CARD: "Cartão", CASH: "Dinheiro" }[value],
      })),
    );
    const area = form.elements.serviceArea;
    area.replaceChildren(
      ...checkout.delivery.serviceAreas.map((value) =>
        element("option", { value, text: value }),
      ),
    );
    $("#serviceAreaLabel").hidden = !checkout.delivery.serviceAreas.length;
    $("#pickupAddress").textContent = checkout.pickup.address;
    $("#pixKey").textContent = checkout.pix.key;
    $("#pixRecipient").textContent = checkout.pix.recipientName;
    updateCheckout();
  }
  function updateCheckout() {
    const delivery = form.elements.fulfillment?.value === "delivery";
    const payment = form.elements.payment?.value;
    $("#deliveryFields").hidden = !delivery;
    form.elements.address.required = delivery;
    $("#pickupAddress").hidden = delivery;
    $("#pixBox").hidden = payment !== "PIX";
    $("#cashLabel").hidden = payment !== "CASH";
    $("#checkoutTotal").textContent = money(
      subtotal() + (delivery ? state.config.checkout.delivery.feeMinor : 0),
    );
    $("#submitOrder").disabled =
      !items.length || sending || items.some((item) => !productFor(item));
  }
  form.addEventListener("change", updateCheckout);
  form.elements.phone.addEventListener("input", (event) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
    event.target.value =
      digits.length > 2
        ? `(${digits.slice(0, 2)}) ${digits.slice(2, digits.length > 10 ? 7 : 6)}${digits.length > 6 ? "-" + digits.slice(digits.length > 10 ? 7 : 6) : ""}`
        : digits;
  });
  $("#copyPix").addEventListener("click", () =>
    copyText(state.config.checkout.pix.key),
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending || !items.length) {
      return;
    }
    const payload = {
      customer: {
        name: form.elements.name.value,
        phone: form.elements.phone.value,
      },
      address: form.elements.address.value,
      serviceArea: form.elements.serviceArea.value,
      paymentMethod: form.elements.payment.value,
      fulfillment: form.elements.fulfillment.value,
      cashTenderedMinor: Math.round(
        Number(form.elements.cash.value || 0) * 100,
      ),
      items: items.map((i) => ({ ...i })),
    };
    const serialized = JSON.stringify(payload);
    // Persist only a fingerprint, not personal checkout details. Reuse key after an uncertain response.
    const bytes = new TextEncoder().encode(serialized);
    const fingerprint = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (!pending || pending.fingerprint !== fingerprint) {
      pending = { fingerprint, key: crypto.randomUUID() };
      storageSet(`${key}:pending`, pending);
    }
    sending = true;
    updateCheckout();
    $("#checkoutError").textContent = "";
    try {
      const order = await state.api("/orders", {
        method: "POST",
        body: payload,
        headers: { "Idempotency-Key": pending.key },
      });
      items = [];
      persist();
      pending = null;
      storageSet(`${key}:pending`, null);
      render();
      form.hidden = true;
      const receipt = $("#receipt");
      receipt.hidden = false;
      receipt.replaceChildren(
        element("h2", { text: "Pedido recebido!" }),
        element("p", {
          text: `Pedido #${order.id.slice(0, 8)} · ${money(order.totalMinor)}`,
        }),
        element("p", {
          text: "Status: Pendente. A loja vai confirmar seu pedido e pagamento.",
        }),
        ...order.items.map((item) =>
          element("p", {
            text: `${item.quantity} × ${item.name} — ${money(item.subtotalMinor)}`,
          }),
        ),
      );
      if (order.paymentMethod === "PIX") {
        receipt.append(
          element("p", { text: `PIX: ${state.config.checkout.pix.key}` }),
          element("button", {
            text: "Copiar chave PIX",
            onclick: () => copyText(state.config.checkout.pix.key),
          }),
        );
      }
      if (state.config.checkout.completionMode === "WHATSAPP_HANDOFF") {
        const summary = `Pedido #${order.id.slice(0, 8)}\n${order.items.map((i) => `${i.quantity} × ${i.name}`).join("\n")}\nTotal: ${money(order.totalMinor)}`;
        receipt.append(
          element("a", {
            class: "primary",
            text: "Enviar resumo ao WhatsApp da loja",
            href: `https://wa.me/${state.config.checkout.contactPhone}?text=${encodeURIComponent(summary)}`,
            target: "_blank",
            rel: "noopener noreferrer",
          }),
        );
      }
      receipt.append(
        element("button", {
          text: "Continuar comprando",
          onclick: () => $("#cartDialog").close(),
        }),
      );
      state.products = await state.api("/products");
      state.refreshCatalog();
    } catch (error) {
      $("#checkoutError").textContent = error.message;
    } finally {
      sending = false;
      updateCheckout();
    }
  });
  function open() {
    form.hidden = false;
    $("#receipt").hidden = true;
    render();
    if (state.user) {
      if (!form.elements.name.value) {
        form.elements.name.value = state.user.name || "";
      }
      if (!form.elements.phone.value) {
        form.elements.phone.value = state.user.phone || "";
      }
    }
    const dialog = $("#cartDialog");
    if (!dialog.open) {
      if (window.matchMedia("(min-width:1100px)").matches) {
        dialog.show();
      } else {
        openDialog(dialog);
      }
    }
    state.coachFor?.("checkout");
  }
  window.matchMedia("(min-width:1100px)").addEventListener("change", () => {
    const dialog = $("#cartDialog");
    if (dialog.open) {
      dialog.close();
      open();
    }
  });
  $("#cartButton").addEventListener("click", open);
  $("#mobileCart").addEventListener("click", open);
  return { add, render, configure, open };
}
