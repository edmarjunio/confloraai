import {
  $,
  element,
  money,
  notify,
  storageGet,
  storageSet,
  openDialog,
  quantityControl,
} from "./ui.js";
import { icon } from "./icons.js";
import { onLanguageChange } from "./i18n/index.js";
import { storeQueries } from "./query/tanstackQuery.js";
import { renderOrderReceipt } from "./receipt.js";
import { normalizeStoredCart } from "./cart-storage.mjs";

export function createCart(state) {
  try {
    localStorage.removeItem(`store:${state.slug}:cart:v1`);
    localStorage.removeItem('conflora_cart_items_v2'); localStorage.removeItem('conflora_customer_info_v2');
  } catch { /* Existing shared drafts cannot be attributed safely to an account. */ }
  const tabId = window.ConfloraSession?.tabId || crypto.randomUUID();
  const ownerId = (user) => user?.id ? `user:${user.id}` : `guest:${tabId}`;
  let owner = ownerId(state.user);
  let key = `store:${state.slug}:cart:v2:${owner}`;
  const stored = storageGet(key, []);
  let items = normalizeStoredCart(stored);
  let deliveryLocation = null;
  const locationPicker = $("#deliveryLocationPicker");
  locationPicker?.addEventListener("locationchange", (event) => { deliveryLocation = event.detail; if (!form.elements.address.value.trim() && deliveryLocation.address) form.elements.address.value = deliveryLocation.address; });
  let sending = false;
  let confirmationAccepted = false;
  let pending = storageGet(`${key}:pending`, null);
  const form = $("#checkoutForm");

  // Subscribe to reactive language changes
  onLanguageChange(() => {
    configure();
    render();
  });

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
    const min = product.saleUnit?.minimum || 1;
    const inc = product.saleUnit?.increment || 1;
    const steps = (quantity - min) / inc;
    if (
      !Number.isFinite(quantity) ||
      quantity < min ||
      Math.abs(steps - Math.round(steps)) > 0.00001
    ) {
      notify("common.required_fields".tr);
      return;
    }
    const current = items.find((i) => i.productId === product.id);
    const next = Number(((current?.quantity || 0) + quantity).toFixed(6));
    if (
      !product.isAvailable ||
      (product.stock?.tracked && product.stock.quantity < next)
    ) {
      notify("catalog.out_of_stock".tr);
      return;
    }
    if (current) {
      current.quantity = next;
    } else {
      items.push({ productId: product.id, quantity });
    }
    persist();
    render();
    notify(`${product.name} ${"catalog.added_to_cart".tr}`);
    state.trackEvent?.("add_to_cart", {
      productId: product.id,
      productName: product.name,
      category: product.categoryName,
      value: Number(product.price?.amountMinor || 0) / 100,
    });



  }

  function render() {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    $("#cartCount").textContent = $("#mobileCount").textContent = Number(
      count.toFixed(3),
    ).toLocaleString("pt-BR");
    $("#cartFabCount").textContent = Number(count.toFixed(3)).toLocaleString("pt-BR");
    $("#cartTitle").textContent = `${"cart.title".tr} (${items.length})`;
    $("#cartClearButton").disabled = items.length === 0 || sending;
    $("#cartTotal").textContent = $("#mobileTotal").textContent =
      money(subtotal());
    $("#cartItems").replaceChildren(
      ...items.map((item) => {
        const product = productFor(item);
        const imageCandidates = window.ConfloraProductCard?.getImageCandidates(product) || product?.images || [];
        const remove = () => {
          items = items.filter((i) => i !== item);
          persist();
          render();

        };
        const quantity = element("input", {
          type: "number",
          min: product?.saleUnit?.minimum || 1,
          step: product?.saleUnit?.increment || 1,
          value: item.quantity,
          "aria-label": `${"product.quantity".tr} ${product?.name || ""}`,
        });
        quantity.addEventListener("change", () => {
          const value = Number(quantity.value);
          const minVal = product?.saleUnit?.minimum || 1;
          const incVal = product?.saleUnit?.increment || 1;
          if (
            !product ||
            value < minVal ||
            !Number.isFinite(value) ||
            (product.stock?.tracked && value > product.stock.quantity) ||
            Math.abs(value / incVal - Math.round(value / incVal)) > 0.00001
          ) {
            render();
            return;
          }
          item.quantity = value;
          persist();
          render();

        });
        return element("article", { class: "cart-item" }, [
          element("render-image", {
            src: imageCandidates[0] || product?.imageUrl || "/store-assets/placeholder.svg",
            "image-candidates": JSON.stringify(imageCandidates.slice(1)),
            "fallback-src": "/store-assets/placeholder.svg",
            alt: "",
            class: "cart-item-image",
          }),
          element("div", {}, [
            element("strong", {
              text: product?.name || "catalog.unavailable".tr,
              title: product?.name || "catalog.unavailable".tr,
            }),
            element("span", {
              text: money((product?.price?.amountMinor || 0) * item.quantity),
            }),
          element("div", { class: "cart-item-quantity-row" }, [
            quantityControl(quantity),
            element("span", {
              class: "cart-item-unit-label",
              text: product?.saleUnit?.label || "unidade",
            }),
          ]),
          ]),
          element(
            "button",
            {
              class: "quiet",
              "aria-label": `${"common.remove".tr} ${product?.name || ""}`,
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
          text: "cart.empty_subtitle".tr,
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
        input.defaultChecked = index === 0;
        input.checked = index === 0;
        return element("label", {}, [
          input,
          icon(
            {
              delivery: "truck",
              pickup: "store",
              PIX: "pix",
              CARD: "card",
              CREDITO: "card",
              DEBITO: "card",
              CASH: "cash",
              DINHEIRO: "cash",
            }[option.value],
          ),
          element("span", { text: option.label }),
        ]);
      }),
    );
  }

  function configure() {
    if (!state.config?.checkout) {
      return;
    }
    const checkout = state.config.checkout;
    choices(
      $("#fulfillmentOptions"),
      "fulfillment",
      ["delivery", "pickup"]
        .filter((type) => checkout[type]?.enabled)
        .map((type) => ({
          value: type,
          label: type === "delivery" ? "Entrega" : "Retirada",
        })),
    );
    choices(
      $("#paymentOptions"),
      "payment",
      window.ConfloraOrderDisplay.customerPaymentMethods(checkout.enabledPayments)
        .filter((value) => String(value).toUpperCase() !== "FIADO")
        .map((value) => ({
          value,
          label: window.ConfloraOrderDisplay.payment(value),
        })),
    );
    const area = form.elements.serviceArea;
    if (area && checkout.delivery?.serviceAreas) {
      area.replaceChildren(
        ...checkout.delivery.serviceAreas.map((value) =>
          element("option", { value, text: value }),
        ),
      );
    }
    $("#serviceAreaLabel").hidden = !checkout.delivery?.serviceAreas?.length;
    $("#pickupAddress").textContent = checkout.pickup?.address || "";
    updateCheckout();
  }

  function updateCheckout() {
    const delivery = form.elements.fulfillment?.value === "delivery";
    const payment = form.elements.payment?.value;
    $("#deliveryFields").hidden = !delivery;
    if (locationPicker) { locationPicker.setAttribute("address", form.elements.address?.value || ""); }
    if (form.elements.address) {
      form.elements.address.required = delivery;
      form.elements.address.minLength = delivery ? 8 : 0;
    }
    if (form.elements.serviceArea) {
      form.elements.serviceArea.required = delivery && Boolean(state.config?.checkout?.delivery?.serviceAreas?.length);
    }
    $("#pickupAddress").hidden = delivery;
    $("#pixBox").hidden = payment !== "PIX";
    $("#cashLabel").hidden = payment !== "CASH";
    if (form.elements.cash) {
      form.elements.cash.required = payment === "CASH";
      form.elements.cash.min = (subtotal() + (delivery ? state.config?.checkout?.delivery?.feeMinor || 0 : 0)) / 100;
    }
    if (form.elements.cash) {
      form.elements.cash.required = payment === "CASH";
      form.elements.cash.min = (subtotal() + (delivery ? state.config?.checkout?.delivery?.feeMinor || 0 : 0)) / 100;
    }
    const feeMinor = delivery ? (state.config?.checkout?.delivery?.feeMinor || 0) : 0;
    $("#checkoutTotal").textContent = money(subtotal() + feeMinor);
    $("#submitOrder").disabled =
      !items.length || sending || items.some((item) => !productFor(item));
  }

  form.addEventListener("change", updateCheckout);
  form.elements.address?.addEventListener("input", () => { if (locationPicker) locationPicker.setAttribute("address", form.elements.address.value); });
  form.elements.phone?.addEventListener("input", (event) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
    event.target.value =
      digits.length > 2
        ? `(${digits.slice(0, 2)}) ${digits.slice(2, digits.length > 10 ? 7 : 6)}${digits.length > 6 ? "-" + digits.slice(digits.length > 10 ? 7 : 6) : ""}`
        : digits;
  });

  function showOrderReview() {
    const delivery = form.elements.fulfillment?.value === "delivery";
    const paymentMethod = form.elements.payment?.value || "PIX";
    const address = form.elements.address?.value.trim() || "";
    const serviceArea = form.elements.serviceArea?.value || "";
    const fee = delivery ? state.config?.checkout?.delivery?.feeMinor || 0 : 0;
    const total = subtotal() + fee;
    const rows = [
      element("div", { class: "order-review-section" }, [
        element("strong", { text: "Cliente".tr }),
        element("p", { text: form.elements.name.value.trim() }),
        element("p", { text: form.elements.phone.value.trim() }),
      ]),
      element("div", { class: "order-review-section" }, [
        element("strong", { text: delivery ? "Entrega".tr : "Retirada".tr }),
        ...(delivery
          ? [
              ...(serviceArea ? [element("p", { text: serviceArea })] : []),
              element("p", { text: address }),
              ...(fee ? [element("p", { text: "Taxa de entrega: ".tr + money(fee) })] : []),
            ]
          : [element("p", { text: state.config?.checkout?.pickup?.address || "Retirada".tr })]),
      ]),
      element("div", { class: "order-review-section" }, [
        element("strong", { text: "Pagamento".tr }),
        element("p", { text: paymentMethod === "CASH"
          ? "Dinheiro · troco para ".tr + money(Math.round(Number(form.elements.cash.value || 0) * 100))
          : window.ConfloraOrderDisplay.payment(paymentMethod).tr }),
      ]),
      element("div", { class: "order-review-items" }, [
        ...items.map((item) => {
          const product = productFor(item);
          return element("div", { class: "order-review-item" }, [
            element("span", { text: item.quantity + " × " + (product?.name || "Produto") }),
            element("strong", { text: money(Math.round((product?.price.amountMinor || 0) * item.quantity)) }),
          ]);
        }),
        element("div", { class: "order-review-total" }, [
          element("strong", { text: "Total do pedido".tr }),
          element("strong", { text: money(total) }),
        ]),
      ]),
    ];
    $("#orderReviewContent").replaceChildren(...rows);
    $("#orderReviewError").textContent = "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submittingOwner = owner;
    if (sending || !items.length) {
      return;
    }
    if (!confirmationAccepted) {
      const phoneDigits = form.elements.phone.value.replace(/\D/g, "");
      const delivery = form.elements.fulfillment?.value === "delivery";
      const address = form.elements.address?.value.trim() || "";
      const cash = Math.round(Number(form.elements.cash?.value || 0) * 100);
      const payment = form.elements.payment?.value;
      const total = subtotal() + (delivery ? state.config?.checkout?.delivery?.feeMinor || 0 : 0);
      if (!form.elements.name.value.trim() || phoneDigits.length < 10 || phoneDigits.length > 11) {
        $("#checkoutError").textContent = "Informe o nome e um número de WhatsApp válido com DDD.".tr;
        return;
      }
      if (delivery && address.length < 8) {
        $("#checkoutError").textContent = "Informe o endereço completo para a entrega.".tr;
        form.elements.address?.focus();
        return;
      }
      if (payment === "FIADO") {
        $("#checkoutError").textContent = "Fiado disponível somente no caixa.".tr;
        return;
      }
      if (payment === "CASH" && cash < total) {
        $("#checkoutError").textContent = "Informe para quanto precisa de troco. O valor deve ser igual ou maior que o total.".tr;
        form.elements.cash?.focus();
        return;
      }
      showOrderReview();
      openDialog($("#orderConfirmDialog"));
      return;
    }
    confirmationAccepted = false;
    const payload = {
      analyticsClientId: state.analyticsClientId,
      customer: {
        name: form.elements.name.value,
        phone: form.elements.phone.value,
      },
      deliveryLocation: form.elements.fulfillment?.value === "delivery" ? deliveryLocation : null,
      address: form.elements.address ? form.elements.address.value : "",
      serviceArea: form.elements.serviceArea ? form.elements.serviceArea.value : "",
      paymentMethod: form.elements.payment ? form.elements.payment.value : "PIX",
      fulfillment: form.elements.fulfillment ? form.elements.fulfillment.value : "pickup",
      cashTenderedMinor: Math.round(
        Number(form.elements.cash?.value || 0) * 100,
      ),
      items: items.map((i) => ({ ...i })),
    };
    state.trackEvent?.("begin_checkout", { value: subtotal() / 100, resultCount: items.length });

    const serialized = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(serialized);
    const fingerprint = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (owner !== submittingOwner) return;
    if (!pending || pending.fingerprint !== fingerprint) {
      pending = { fingerprint, key: crypto.randomUUID() };
      storageSet(`${key}:pending`, pending);
    }
    sending = true;
    updateCheckout();
    $("#checkoutError").textContent = "";

    try {
      // Execute order via TanStack Query mutation
      const order = await storeQueries.submitOrder(payload, state.api, pending.key);
      if (owner !== submittingOwner) return;
      state.trackEvent?.("order_created", {
        orderId: order.id,
        value: Number(order.totalMinor || subtotal()) / 100,
        resultCount: payload.items.length,
        items: payload.items.map((item) => {
          const product = productFor(item);
          return {
            productId: item.productId,
            productName: product?.name || "Produto",
            category: product?.categoryName || "",
            value: Number(product?.price?.amountMinor || 0) / 100,
            quantity: item.quantity,
          };
        }),
      });

      items = [];
      persist();
      pending = null;
      storageSet(`${key}:pending`, null);

      render();
      form.hidden = true;
      $("#checkoutCustomer").hidden = true;
      const receipt = $("#receipt");
      receipt.hidden = false;
      receipt.replaceChildren(
        element("h2", { text: "cart.order_success_title".tr }),
        element("p", { text: "cart.order_success_desc".tr }),
        renderOrderReceipt(order),
      );
      receipt.append(
        element("button", {
          type: "button",
          class: "quiet",
          style: "margin-top: 16px; width: 100%;",
          text: "cart.new_order".tr,
          onclick: () => {
            receipt.hidden = true;
            form.hidden = false;
            $("#checkoutCustomer").hidden = false;
            close();
          },
        }),
      );
    } catch (error) {
      if (owner !== submittingOwner) return;
      $("#checkoutError").textContent = error.message;
    } finally {
      sending = false;
      updateCheckout();
    }
  });

  $("#orderReviewConfirm").addEventListener("click", () => {
    if (!form.reportValidity()) {
      $("#orderConfirmDialog").close();
      return;
    }
    confirmationAccepted = true;
    $("#orderConfirmDialog").close();
    form.requestSubmit();
  });
  $("#orderReviewBack").addEventListener("click", () => $("#orderConfirmDialog").close());
  $("#orderReviewClose").addEventListener("click", () => $("#orderConfirmDialog").close());

  function open() {
    const dialog = $("#cartDialog");
    if (!dialog.open) dialog.show();
    if (!state.existingStore) return;
    const customerSessionId = state.user?.id;
    const before = Object.fromEntries(['name', 'phone', 'address'].map((field) => [field, form.elements[field]?.value || '']));
    window.ConfloraSession.apiFetch('/api/customer/profile').then(async (response) => {
      if (!response.ok) return;
      const profile = await response.json();
      if (customerSessionId !== state.user?.id) return;
      for (const field of ['name', 'phone', 'address']) {
        if (form.elements[field] && !before[field] && !form.elements[field].value) {
          form.elements[field].value = field === 'phone' ? String(profile[field] || '').replace(/^55(?=\d{10,11}$)/, '') : profile[field] || '';
        }
      }
    }).catch(() => {});

  }

  function close() {
    $("#cartDialog").close();
  }

  function clear() {
    if (items.length === 0 || sending) return;
    items = [];
    confirmationAccepted = false;
    persist();

    render();
  }

  $("#cartButton").addEventListener("click", open);
  $("#mobileCart").addEventListener("click", open);
  $("#cartFab").addEventListener("click", open);
  $("#cartCloseButton").addEventListener("click", close);
  $("#cartClearButton").addEventListener("click", clear);

  function setOwner(user) {
    const nextOwner = ownerId(user);
    if (owner === nextOwner) return;
    persist(); owner = nextOwner; key = `store:${state.slug}:cart:v2:${owner}`;
    items = normalizeStoredCart(storageGet(key, []));
    pending = storageGet(`${key}:pending`, null);
    confirmationAccepted = false; deliveryLocation = null;
    form.reset(); form.hidden = false; $('#checkoutCustomer').hidden = false;
    $('#receipt').replaceChildren(); $('#receipt').hidden = true;
    for (const field of ['name', 'phone', 'address', 'cash']) if (form.elements[field]) form.elements[field].value = '';
    locationPicker?.clearLocation?.();
    $('#checkoutError').textContent = '';
    $('#orderConfirmDialog').close();
    render();
  }
  window.addEventListener('storage', (event) => {
    if (event.key !== key || sending) return;
    items = normalizeStoredCart(storageGet(key, [])); confirmationAccepted = false;
    $('#orderConfirmDialog').close(); render();
  });
  return { add, render, configure, open, close, setOwner };
}
