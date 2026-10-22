import {
  $,
  element,
  money,
  notify,
  storageGet,
  storageSet,
  openDialog,
  lockBodyScroll,
  unlockBodyScroll,
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
  let previousCount = items.reduce((sum, item) => sum + item.quantity, 0);
  let fabAnimation;
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
    const receipt = $("#receipt");
    if (receipt && !receipt.hidden) {
      resetCartView();
    }
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

  function triggerCartWiggle() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const targets = [
      $("#cartFab"),
      $("#cartFab")?.querySelector('[data-icon="cart"]'),
      $("#cartButton")?.querySelector('[data-icon="cart"]'),
      $("#cartButton"),
      $("#mobileCart"),
    ].filter(Boolean);

    targets.forEach((el) => {
      el.classList.remove("cf-cart-wiggle");
      void el.offsetWidth;
      el.classList.add("cf-cart-wiggle");
      setTimeout(() => {
        el.classList.remove("cf-cart-wiggle");
      }, 700);
    });
  }

  function resetCartView() {
    const receipt = $("#receipt");
    if (receipt) {
      receipt.hidden = true;
      receipt.replaceChildren();
    }
    form.hidden = false;
    const checkoutCustomer = $("#checkoutCustomer");
    if (checkoutCustomer) {
      checkoutCustomer.hidden = false;
    }
    if (form.elements.cash) form.elements.cash.value = "";
    if (form.elements.note) form.elements.note.value = "";
    $("#checkoutError").textContent = "";
    confirmationAccepted = false;
    updateCheckout();
  }

  function render() {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    if (count > previousCount && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fabAnimation?.cancel();
      fabAnimation = $("#cartFab").animate([{ scale: '1' }, { scale: '1.08', offset: 0.45 }, { scale: '1' }], { duration: 300, easing: 'ease-out' });
      triggerCartWiggle();
    }
    previousCount = count;
    $("#cartCount").textContent = $("#mobileCount").textContent = Number(
      count.toFixed(3),
    ).toLocaleString("pt-BR");
    $("#cartFabCount").textContent = Number(count.toFixed(3)).toLocaleString("pt-BR");
    $("#cartTitle").textContent = `${"cart.title".tr} (${items.length})`;
    $("#cartClearButton").disabled = items.length === 0 || sending;
    $("#cartClearButton").style.display = items.length === 0 ? "none" : "";
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

  const cartoonChoiceIcons = {
    delivery: `<svg viewBox="0 0 28 28" width="24" height="24" class="cart-choice-svg" aria-hidden="true"><rect x="2" y="7" width="14" height="12" rx="2.5" fill="#22c55e" stroke="#0f172a" stroke-width="1.8"/><path d="M16 10h5.5l3.5 4.5v4.5H16z" fill="#4ade80" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7" cy="20" r="3" fill="#f8fafc" stroke="#0f172a" stroke-width="1.8"/><circle cx="7" cy="20" r="1.2" fill="#0f172a"/><circle cx="20" cy="20" r="3" fill="#f8fafc" stroke="#0f172a" stroke-width="1.8"/><circle cx="20" cy="20" r="1.2" fill="#0f172a"/><rect x="18" y="11.5" width="4" height="3" rx="1" fill="#38bdf8" stroke="#0f172a" stroke-width="1.2"/></svg>`,
    pickup: `<svg viewBox="0 0 28 28" width="24" height="24" class="cart-choice-svg" aria-hidden="true"><path d="M4 11v11h20V11" fill="#f8fafc" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/><path d="M2.5 11 5.5 5h17l3 6z" fill="#facc15" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/><path d="M2.5 11c0 1.5 1.2 2.5 2.5 2.5s2.5-1 2.5-2.5c0 1.5 1.2 2.5 2.5 2.5s2.5-1 2.5-2.5c0 1.5 1.2 2.5 2.5 2.5s2.5-1 2.5-2.5c0 1.5 1.2 2.5 2.5 2.5s2.5-1 2.5-2.5" fill="none" stroke="#0f172a" stroke-width="1.6"/><rect x="11" y="15" width="6" height="7" rx="1.5" fill="#22c55e" stroke="#0f172a" stroke-width="1.6"/></svg>`,
    pix: `<svg viewBox="535 24 80 80" width="26" height="26" class="cart-choice-svg cf-pix-svg" aria-hidden="true"><path class="pix-glyph" fill="#32bcad" d="M 596.82737,86.620206 c -3.08045,0 -5.97782,-1.19944 -8.15622,-3.37679 l -11.77678,-11.77713 c -0.82691,-0.82903 -2.26801,-0.82656 -3.09456,0 l -11.81982,11.82017 c -2.17841,2.17734 -5.07577,3.37679 -8.15623,3.37679 h -2.32092 l 14.9158,14.915444 c 4.65807,4.65808 12.21069,4.65808 16.86912,0 l 14.95813,-14.958484 z"/><path class="pix-glyph" fill="#32bcad" d="M 553.82362,44.963326 c 3.08046,0 5.97782,1.19944 8.15622,3.37679 l 11.81982,11.82193 c 0.85125,0.85161 2.2412,0.85479 3.09457,-10e-4 l 11.77678,-11.77784 c 2.1784,-2.17735 5.07576,-3.37679 8.15622,-3.37679 h 1.41852 l -14.95778,-14.95813 c -4.65878,-4.658432 -12.2114,-4.658432 -16.86948,0 l -14.91509,14.91509 z"/><path class="pix-glyph" fill="#32bcad" d="M 610.61844,57.378776 -9.03922,-9.03922 c -0.19897,0.0797 -0.41452,0.12946 -0.64206,0.12946 h -4.10986 c -2.12478,0 -4.20476,0.86184 -5.70618,2.36432 l -11.77643,11.77678 c -1.10207,1.10208 -2.55022,1.65347 -3.99697,1.65347 -1.44815,0 -2.89524,-0.55139 -3.99697,-1.65241 l -11.82088,-11.82088 c -1.50142,-1.50283 -3.5814,-2.36431 -5.70618,-2.36431 h -5.05354 c -0.21555,0 -0.41698,-0.0508 -0.60713,-0.12242 l -9.07521,9.07521 c -4.65843,4.65843 -4.65843,12.2107 0,16.86913 l 9.07486,9.07485 c 0.1905,-0.0716 0.39193,-0.12241 0.60748,-0.12241 h 5.05354 c 2.12478,0 4.20476,-0.86148 5.70618,-2.36396 l 11.81982,-11.81982 c 2.13643,-2.13466 5.8607,-2.13537 7.995,0.001 l 11.77643,11.77573 c 1.50142,1.50248 3.5814,2.36431 5.70618,2.36431 h 4.10986 c 0.22754,0 0.44309,0.0497 0.64206,0.12947 l 9.03922,-9.03922 c 4.65808,-4.65843 4.65808,-12.2107 0,-16.86913 z"/></svg>`,
    cash: `<svg viewBox="0 0 28 28" width="24" height="24" class="cart-choice-svg" aria-hidden="true"><rect x="2.5" y="6" width="23" height="16" rx="3.5" fill="#4ade80" stroke="#0f172a" stroke-width="1.8"/><rect x="4.5" y="8" width="19" height="12" rx="2.5" fill="#22c55e"/><circle cx="14" cy="14" r="4" fill="#dcfce7" stroke="#0f172a" stroke-width="1.6"/><path d="M14 11.8v4.4M12.6 13c.4-.7 2.2-.8 2.8.2.5 1-2.2 1.2-2.2 2 .1.7 1.4.8 2.2.3" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"/><circle cx="6" cy="14" r="1.5" fill="#dcfce7"/><circle cx="22" cy="14" r="1.5" fill="#dcfce7"/></svg>`,
    credit: `<svg viewBox="0 0 28 28" width="24" height="24" class="cart-choice-svg" aria-hidden="true"><rect x="2.5" y="5" width="23" height="18" rx="4" fill="#38bdf8" stroke="#0f172a" stroke-width="1.8"/><rect x="2.5" y="9.5" width="23" height="3.8" fill="#0f172a"/><rect x="5.5" y="15.5" width="5.5" height="4.5" rx="1.2" fill="#facc15" stroke="#0f172a" stroke-width="1.4"/><path d="M14 17.5h8" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>`,
    debit: `<svg viewBox="0 0 28 28" width="24" height="24" class="cart-choice-svg" aria-hidden="true"><rect x="2.5" y="5" width="23" height="18" rx="4" fill="#c084fc" stroke="#0f172a" stroke-width="1.8"/><rect x="2.5" y="9.5" width="23" height="3.8" fill="#0f172a"/><rect x="5.5" y="15.5" width="5.5" height="4.5" rx="1.2" fill="#facc15" stroke="#0f172a" stroke-width="1.4"/><circle cx="17.5" cy="17.5" r="2.5" fill="#fb7185"/><circle cx="21" cy="17.5" r="2.5" fill="#facc15"/></svg>`,
  };

  function createChoiceCartoonIcon(key) {
    const raw = cartoonChoiceIcons[key] || cartoonChoiceIcons.delivery;
    const slot = document.createElement("span");
    slot.className = "choice-icon-slot";
    slot.innerHTML = raw;
    return slot;
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
        const iconKey = {
          delivery: "delivery",
          pickup: "pickup",
          PIX: "pix",
          CARD: "credit",
          CREDITO: "credit",
          DEBITO: "debit",
          CASH: "cash",
          DINHEIRO: "cash",
        }[option.value] || "delivery";
        const isPix = String(option.value).toUpperCase() === "PIX";
        const iconSlot = createChoiceCartoonIcon(iconKey);
        const children = [input, iconSlot];
        if (!isPix) {
          children.push(element("span", {
            class: "choice-label-slot",
            text: option.label,
          }));
        } else {
          // Sem escrita visível, com acessibilidade para leitores de tela
          children.push(element("span", {
            class: "sr-only",
            text: "Pix",
          }));
        }
        return element("label", {
          class: `choice-card${isPix ? " is-choice-pix" : ""}`,
          title: option.label,
          "aria-label": isPix ? "Pagar com Pix" : undefined,
        }, children);
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
      state.purchaseInsights?.invalidate();
      state.orderNotifications?.received(order);
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
        state.orderNotifications.button(),
      );
      receipt.append(
        element("button", {
          type: "button",
          class: "quiet",
          style: "margin-top: 16px; width: 100%;",
          text: "cart.new_order".tr,
          onclick: () => {
            resetCartView();
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
    window.scrollTo({ left: 0 });
    document.documentElement.scrollLeft = 0;
    const dialog = $("#cartDialog");
    const receipt = $("#receipt");
    if (items.length > 0 && receipt && !receipt.hidden) {
      resetCartView();
    }
    dialog.style.transform = "";
    dialog.style.transition = "";
    openDialog(dialog);
    dialog.scrollTop = 0;
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
    unlockBodyScroll();
  }

  function clear() {
    if (items.length === 0 || sending) return;
    items = [];
    confirmationAccepted = false;
    persist();
    resetCartView();
    render();
  }

  $("#cartButton").addEventListener("click", open);
  $("#mobileCart").addEventListener("click", open);
  $("#cartFab").addEventListener("click", open);
  $("#cartCloseButton").addEventListener("click", () => {
    const receipt = $("#receipt");
    if (receipt && !receipt.hidden) {
      resetCartView();
    }
    close();
  });
  $("#cartDialog")?.addEventListener("close", () => {
    unlockBodyScroll();
    const receipt = $("#receipt");
    if (receipt && !receipt.hidden) {
      resetCartView();
    }
  });
  $("#cartClearButton").addEventListener("click", clear);

  function setOwner(user) {
    const nextOwner = ownerId(user);
    if (owner === nextOwner) return;
    persist(); owner = nextOwner; key = `store:${state.slug}:cart:v2:${owner}`;
    items = normalizeStoredCart(storageGet(key, []));
    previousCount = items.reduce((sum, item) => sum + item.quantity, 0);
    fabAnimation?.cancel();
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
