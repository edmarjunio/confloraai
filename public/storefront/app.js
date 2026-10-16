import {
  $,
  element,
  createApi,
  openDialog,
  notify,
  money,
} from "./ui.js";
import { createCatalog } from "./catalog.js";
import { createCart } from "./cart.js";
import { createChat } from "./chat.js";
import { createAdmin } from "./admin.js";
import { createExistingApi } from "./existing-api.js";
import { createProductEntry } from "./product-entry.js";
import { icon } from "./icons.js";
import {
  getLanguage,
  setLanguage,
  applyHtmlTranslations,
  onLanguageChange,
} from "./i18n/index.js";
import { appStore } from "./store/index.js";
import { storeQueries, queryClient } from "./query/tanstackQuery.js";
import { renderOrderReceipt } from "./receipt.js";

const existingStore = !location.pathname.startsWith("/shop/");
const slug = existingStore
  ? "conflora"
  : decodeURIComponent(location.pathname.split("/")[2]);
const basePath = existingStore ? "" : `/shop/${slug}`;

const state = {
  existingStore,
  slug,
  basePath,
  api: existingStore ? createExistingApi() : createApi(slug),
  config: null,
  products: [],
  user: null,
};

let analyticsVisitorId = "";
try {
  analyticsVisitorId = localStorage.getItem("conflora_analytics_visitor") || "";
  if (!analyticsVisitorId) {
    analyticsVisitorId = crypto.randomUUID();
    localStorage.setItem("conflora_analytics_visitor", analyticsVisitorId);
  }
} catch {
  analyticsVisitorId = `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
const analyticsCampaign = new URLSearchParams(location.search);
function trackStorefrontEvent(eventName, details = {}) {
  if (!existingStore) return;
  const event = {
    eventName,
    visitorId: analyticsVisitorId,
    utmSource: analyticsCampaign.get("utm_source") || "",
    utmMedium: analyticsCampaign.get("utm_medium") || "",
    utmCampaign: analyticsCampaign.get("utm_campaign") || "",
    ...details,
  };
  fetch("/api/analytics/events", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  }).catch(() => {});
  if (typeof window.gtag === "function") {
    const item = Array.isArray(event.items) && event.items.length ? event.items.map((entry) => ({
      item_id: entry.productId,
      item_name: entry.productName,
      item_category: entry.category,
      price: entry.value,
      quantity: entry.quantity,
    })) : event.productId ? [{
      item_id: event.productId,
      item_name: event.productName,
      item_category: event.category,
      price: event.value,
    }] : undefined;
    window.gtag("event", eventName, {
      currency: "BRL",
      ...(event.value !== undefined ? { value: event.value } : {}),
      ...(item ? { items: item } : {}),
      ...(event.orderId ? { transaction_id: event.orderId } : {}),
      ...(event.searchLength ? { search_term_length: event.searchLength } : {}),
      ...(event.resultCount !== undefined ? { results: event.resultCount } : {}),
    });
  }
}
state.trackEvent = trackStorefrontEvent;

if (existingStore) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", "G-TX7SZBP9J8");
  const analyticsScript = document.createElement("script");
  analyticsScript.async = true;
  analyticsScript.src = "https://www.googletagmanager.com/gtag/js?id=G-TX7SZBP9J8";
  document.head.append(analyticsScript);
}

const cashierShortcut = $("#cashierShortcut");
function updateHeaderActions() {
  const role = String(state.user?.role || "CLIENTE").toUpperCase();
  const isLoggedIn = Boolean(state.user);
  const allowedCashierRoles = ["ADMIN", "CAIXA", "VENDEDOR"];
  const identity = $("#headerAccountIdentity");
  const historyButton = $("#historyButton");

  identity.hidden = !isLoggedIn;
  historyButton.hidden = !isLoggedIn || !existingStore;
  $("#accountButton").hidden = isLoggedIn;
  $("#adminSettingsButton").hidden = role !== "ADMIN";
  cashierShortcut.hidden = !allowedCashierRoles.includes(role);

  if (isLoggedIn) {
    $("#headerAccountName").textContent =
      state.user.name || state.user.email || "Usuário";
    $("#headerAccountRole").textContent = role;
    identity.setAttribute(
      "aria-label",
      `Abrir conta de ${state.user.name || "usuário"} (${role})`,
    );
  }
}
cashierShortcut.addEventListener("click", () => location.assign("/caixa"));
$("#adminSettingsButton").addEventListener("click", () => {
  if (String(state.user?.role || "").toUpperCase() === "ADMIN") {
    location.assign(existingStore ? "/admin" : `${basePath}/admin`);
  }
});

let catalog;
let cart;
let chat;
let admin;

function navigate(path) {
  for (const dialog of document.querySelectorAll("dialog[open]")) {
    dialog.close();
  }
  history.pushState({}, "", path);
  route();
  window.scrollTo({ top: 0 });
}

function setBottomNavigationActive(activeButton) {
  for (const button of document.querySelectorAll(".mobile-bar-item")) {
    const isActive = button === activeButton;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

async function route() {
  if (!state.config) {
    return;
  }
  const path = (
    existingStore ? "/shop/conflora" + location.pathname : location.pathname
  ).split("/");
  const isAdmin = path[3] === "admin" || path[3] === "configuracoes";
  const isProduct = path[3] === "products";
  $("#catalogView").hidden = isAdmin || isProduct;
  $("#productView").hidden = !isProduct;
  $("#adminView").hidden = !isAdmin;
  document.title = state.config.identity?.name || "Loja";
  try {
    if (isAdmin) {
      await admin.render();
    } else if (isProduct) {
      catalog.details(decodeURIComponent(path[4] || ""));
    } else {
      catalog.render();
    }
  } catch (error) {
    notify(error.message);
  }
}

function applyConfig() {
  const config = state.config;
  if (!config) {
    return;
  }
  appStore.getState().setConfig(config);

  const tokens = {
    primary: "--primary-color",
    accent: "--accent-color",
    text: "--text-color",
    background: "--bg-color",
  };
  for (const [name, token] of Object.entries(tokens)) {
    if (config.branding?.colors?.[name]) {
      document.documentElement.style.setProperty(
        token,
        config.branding.colors[name],
      );
    }
  }

  if (config.branding?.colors?.primary) {
    const rgb = config.branding.colors.primary
      .slice(1)
      .match(/.{2}/g)
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    document.documentElement.style.setProperty(
      "--on-primary",
      luminance > 0.179 ? "#1A1A1A" : "#FFFFFF",
    );
    const metaTheme = document.querySelector("meta[name=theme-color]");
    if (metaTheme) {
      metaTheme.content = config.branding.colors.primary;
    }
  }

  $("#storeName").textContent = config.identity?.name || "Loja";
  $("#subtitle").textContent = config.identity?.subtitle || "";
  $("#region").textContent = [config.identity?.city, config.identity?.region]
    .filter(Boolean)
    .join(" · ");
  const logoUrl = existingStore
    ? "/store-assets/brands/conflora-logo.png"
    : config.branding?.logoUrl || "/store-assets/brands/conflora-logo.png";
  const logo = $("#logo");
  const defaultLogoUrl = "/store-assets/brands/conflora-logo.png";
  $("#brand").classList.add("has-logo");
  logo.hidden = false;
  logo.onerror = () => {
    if (logo.src !== new URL(defaultLogoUrl, window.location.href).href) {
      logo.src = defaultLogoUrl;
      return;
    }
    logo.hidden = true;
    $("#brand").classList.remove("has-logo");
  };
  logo.src = logoUrl;
  logo.alt = existingStore ? "Conflora Horta e Viveiro" : config.identity?.name || "";
  $("#storeIcon").href = config.branding?.iconUrl || "data:,";
  $("#brand").href = basePath || "/";

  cart?.configure();
  chat?.configure();
  applyHtmlTranslations();
}

state.applyConfig = applyConfig;
state.refreshCatalog = () => catalog?.render();
state.reloadProducts = async () => {
  // Query via TanStack Query cache invalidation
  queryClient.invalidateQueries({ queryKey: ["catalog"] });
  state.products = await storeQueries.getCatalog(slug, state.api);
  catalog?.render();
  cart?.render();
};

async function account() {
  const content = $("#accountContent");
  content.replaceChildren();
  $("#googleAccount").hidden = !existingStore || !!state.user;
  if (state.user) {
    $("#accountTitle").textContent = "Sua conta";
    $("#accountSubtitle").textContent = "Gerencie seu acesso e consulte suas compras na Conflora.";
    content.className = "account-content account-signed-in";
    content.append(element("section", { class: "account-profile" }, [
      element("span", { class: "account-profile-eyebrow", text: "CONECTADO" }),
      element("strong", { class: "account-greeting", text: `Olá, ${state.user.name}` }),
      ...(state.user.email ? [element("span", { class: "account-email", text: state.user.email })] : []),
      element("span", { class: "account-role", text: state.user.role || "CLIENTE" }),
    ]));
    if (
      state.user.role === "ADMIN" ||
      (existingStore && state.user.role === "CAIXA")
    ) {
      content.append(
        element("button", {
          class: "primary",
          type: "button",
          text: "team.admin_full".tr,
          onclick: () =>
            existingStore
              ? location.assign("/admin")
              : navigate(`${basePath}/admin`),
        }),
      );
    }
    content.append(
      element("button", {
        class: "account-secondary-action",
        type: "button",
        text: "team.logout".tr,
        onclick: async () => {
          try {
            await state.api("/auth/logout", { method: "POST" });
            if (existingStore && window.signOutGoogle) {
              await window.signOutGoogle().catch(() => {});
            }
            state.user = null;
            appStore.getState().setUser(null);
            catalog?.refreshFavorites();
            updateHeaderActions();
            $("#accountDialog").close();
            navigate(basePath || "/");
          } catch (error) {
            notify(error.message);
          }
        },
      }),
    );
    if (existingStore) {
      content.append(element("button", {
        type: "button",
        class: "primary account-history-action",
        text: "Histórico de compras",
        onclick: () => { $("#accountDialog").close(); openPurchaseHistory(); },
      }));
    }
  } else {
    $("#accountTitle").textContent = "Entrar na sua conta";
    $("#accountSubtitle").textContent = "Acesse seus pedidos e aproveite uma compra mais prática.";
    content.className = "account-content account-signed-out";
    const form = element("form", { class: "account-form" });
    const mode = element("select", { "aria-label": "header.login".tr }, [
      element("option", { value: "login", text: "header.login".tr }),
      element("option", { value: "register", text: "Cadastrar" }),
    ]);
    const name = element("input", {
      name: "name",
      placeholder: "cart.name_label".tr,
      autocomplete: "name",
      maxlength: "100",
    });
    const nameLabel = element("label", { text: "cart.name_label".tr }, [name]);
    nameLabel.hidden = true;
    const email = element("input", {
      type: "email",
      name: "email",
      autocomplete: "email",
      required: "",
    });
    const password = element("input", {
      type: "password",
      name: "password",
      autocomplete: "current-password",
      minlength: existingStore ? "4" : "10",
      maxlength: "128",
      required: "",
    });
    mode.addEventListener("change", () => {
      nameLabel.hidden = mode.value !== "register";
      name.required = mode.value === "register";
      password.autocomplete =
        mode.value === "register" ? "new-password" : "current-password";
      button.textContent = mode.value === "register" ? "Criar minha conta" : "Entrar";
    });
    const button = element("button", {
      type: "submit",
      class: "primary",
      text: "Entrar",
    });
    mode.classList.add("account-mode");
    const errorLabel = element("p", { class: "error", role: "alert" });
    form.append(
      mode,
      nameLabel,
      element("label", { text: "E-mail" }, [email]),
      element("label", { text: "Senha" }, [password]),
      errorLabel,
      button,
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      try {
        state.user = (
          await state.api(`/auth/${mode.value}`, {
            method: "POST",
            body: {
              name: name.value,
              email: email.value,
              password: password.value,
            },
          })
        ).user;
        appStore.getState().setUser(state.user);
        catalog?.refreshFavorites();
        updateHeaderActions();
        $("#accountDialog").close();
        route();
      } catch (error) {
        errorLabel.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
    content.append(form);
  }
  openDialog($("#accountDialog"));
}

$("#googleAccountButton").addEventListener("click", async () => {
  const button = $("#googleAccountButton");
  const status = $("[data-google-status]");
  if (button.disabled || typeof window.authenticateGoogle !== "function") return;
  button.disabled = true;
  status.textContent = "Conectando com sua conta Google…";
  try {
    const result = await window.authenticateGoogle();
    if (!result?.success || !result.user) {
      throw new Error(result?.error || "Não foi possível autenticar sua conta.");
    }
    state.user = result.user;
    appStore.getState().setUser(state.user);
    catalog?.refreshFavorites();
    updateHeaderActions();
    $("#accountDialog").close();
    route();
  } catch (error) {
    status.textContent = error.message || "Não foi possível entrar com Google. Tente novamente.";
  } finally {
    button.disabled = false;
  }
});

const historyDialog = $("#historyDialog");
const historyList = $("#historyList");
const historySentinel = $("#historyLoadSentinel");
const historyState = { buffer: [], cursor: "", hasMore: false, loading: false, failed: false };

function renderPurchase(order) {
  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString("pt-BR") : "Data não informada";
  const items = Array.isArray(order.items) ? order.items : [];
  const total = Number.isFinite(order.totalMinor) ? order.totalMinor : Math.round(Number(order.total || 0) * 100);
  const details = element("details", { class: "history-order-details" }, [
    element("summary", { text: "Ver detalhes da compra" }),
    element("div", { class: "history-order-meta" }, [
      element("span", { text: `Pagamento: ${order.paymentMethod || "Não informado"}` }),
      element("span", { text: `Entrega: ${order.fulfillment === "delivery" ? "Endereço" : order.fulfillment === "pickup" ? "Retirada" : order.deliveryAddress || "Não informado"}` }),
      ...(order.serviceArea ? [element("span", { text: `Região: ${order.serviceArea}` })] : []),
      ...(order.deliveryAddress || order.address ? [element("span", { text: `Endereço: ${order.deliveryAddress || order.address}` })] : []),
      ...items.map((item) => element("span", { text: `${item.quantity || 1} × ${item.name || "Produto"} · ${money(Math.round(Number(item.price || 0) * Number(item.quantity || 1) * 100))}` })),
      renderOrderReceipt(order),
    ]),
  ]);
  return element("article", { class: "history-order-card" }, [
    element("div", { class: "history-order-summary" }, [
      element("div", {}, [
        element("strong", { text: `Pedido #${String(order.id || "").slice(-8).toUpperCase()}` }),
        element("span", { class: "muted", text: createdAt }),
      ]),
      element("div", { class: "history-order-total" }, [
        element("strong", { text: money(total) }),
        element("span", { class: "badge", text: String(order.status || "RECEBIDO").replaceAll("_", " ") }),
      ]),
    ]),
    element("p", { class: "history-order-items", text: `${items.length} ${items.length === 1 ? "item" : "itens"} · ${items.slice(0, 3).map((item) => item.name || "Produto").join(", ")}${items.length > 3 ? "…" : ""}` }),
    details,
  ]);
}

function renderHistoryBatch() {
  const nextOrders = historyState.buffer.splice(0, 6);
  for (const order of nextOrders) historyList.insertBefore(renderPurchase(order), historySentinel);
  if (!historyList.querySelector(".history-order-card") && !historyState.loading && !historyState.hasMore && !historyState.failed) {
    historyList.insertBefore(element("p", { class: "muted", text: "Você ainda não tem compras vinculadas a esta conta." }), historySentinel);
  }
  if (!historyState.buffer.length && historyState.hasMore && !historyState.loading) loadHistoryPage();
  if (!historyState.buffer.length && !historyState.hasMore && !historyState.loading) historySentinel.replaceChildren();
}

async function loadHistoryPage() {
  if (historyState.loading || !historyState.hasMore && historyState.cursor) return;
  historyState.loading = true;
  historySentinel.textContent = "Carregando mais compras…";
  try {
    const query = new URLSearchParams({ limit: "12" });
    if (historyState.cursor) query.set("cursor", historyState.cursor);
    const page = await state.api(`/customer/orders?${query}`);
    historyState.buffer.push(...(page.orders || []));
    historyState.cursor = page.nextCursor || "";
    historyState.hasMore = Boolean(page.hasMore);
    historyState.failed = false;
    if (!historyState.buffer.length && historyState.hasMore) {
      historyState.loading = false;
      return loadHistoryPage();
    }
    renderHistoryBatch();
  } catch (error) {
    historyState.failed = true;
    historySentinel.replaceChildren(element("button", { type: "button", class: "quiet", text: "Tentar novamente", onclick: () => { historyState.failed = false; loadHistoryPage(); } }));
    if (!historyList.querySelector(".history-order-card")) historyList.insertBefore(element("p", { class: "error", text: error.message }), historySentinel);
  } finally {
    historyState.loading = false;
    if (!historyState.buffer.length && historyState.hasMore) loadHistoryPage();
    else if (!historyState.buffer.length) renderHistoryBatch();
  }
}

function openPurchaseHistory() {
  if (!state.user) {
    notify("Entre na sua conta para consultar seu histórico.");
    return;
  }
  historyState.buffer = [];
  historyState.cursor = "";
  historyState.hasMore = false;
  historyState.loading = false;
  historyState.failed = false;
  historyList.replaceChildren(historySentinel);
  historySentinel.textContent = "Carregando suas compras…";
  openDialog(historyDialog);
  if (!historyState.observer && typeof IntersectionObserver === "function") {
    historyState.observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !historyState.loading && !historyState.failed) {
        if (historyState.buffer.length) renderHistoryBatch();
        else if (historyState.hasMore || !historyState.cursor) loadHistoryPage();
      }
    }, { root: historyList, rootMargin: "140px" });
    historyState.observer.observe(historySentinel);
  }
  loadHistoryPage();
}

// Global modal triggers and shortcuts
for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", () => button.closest("dialog").close());
}
for (const node of document.querySelectorAll("[data-icon]")) {
  node.replaceChildren(icon(node.dataset.icon));
}
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      ) {
        dialog.close();
      }
    }
  });
}

// Mobile bottom bar listeners
$("#navCatalogBtn").addEventListener("click", (event) => {
  setBottomNavigationActive(event.currentTarget);
  catalog?.setFavoritesView(false);
  $("#catalogView").scrollIntoView({ behavior: "smooth" });
});
$("#navCategoriesBtn").addEventListener("click", (event) => {
  setBottomNavigationActive(event.currentTarget);
  catalog?.setFavoritesView(false);
  $("#categoryFilterControl").scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
});
$("#navFavoritesBtn").addEventListener("click", (event) => {
  setBottomNavigationActive(event.currentTarget);
  catalog?.setFavoritesView(true);
  $("#catalogView").scrollIntoView({ behavior: "smooth" });
});
$("#navAiBtn").addEventListener("click", (event) => {
  setBottomNavigationActive(event.currentTarget);
  const assistantButton = $("#aiFab");
  if (assistantButton && !assistantButton.hidden) {
    assistantButton.click();
  } else if (!$("#chatDialog").open) {
    openDialog($("#chatDialog"));
  }
});
$("#cartDialog").addEventListener("close", () => {
  setBottomNavigationActive($("#navCatalogBtn"));
});
$("#brand").addEventListener("click", (event) => {
  event.preventDefault();
  navigate(basePath || "/");
});
$("#accountButton").addEventListener("click", () =>
  account().catch((error) => notify(error.message)),
);
$("#headerAccountIdentity").addEventListener("click", () =>
  account().catch((error) => notify(error.message)),
);
$("#historyButton").addEventListener("click", openPurchaseHistory);
$("#historyCloseButton").addEventListener("click", () => historyDialog.close());
historyDialog.addEventListener("click", (event) => { if (event.target === historyDialog) historyDialog.close(); });

// Language Selector listener
const langSelect = $("#languageSelect");
if (langSelect) {
  langSelect.value = getLanguage();
  langSelect.addEventListener("change", (e) => {
    setLanguage(e.target.value);
  });
}

onLanguageChange(() => {
  if (langSelect) {
    langSelect.value = getLanguage();
  }
  applyHtmlTranslations();
  if (state.config) {
    applyConfig();
  }
});

window.addEventListener("popstate", route);

// Application bootstrap
try {
  // Apply initial HTML translations immediately
  applyHtmlTranslations();

  // Load config and catalog products using TanStack Query caching
  [state.config, state.products] = await Promise.all([
    state.api("/config"),
    storeQueries.getCatalog(slug, state.api),
  ]);

  try {
    state.user = (await state.api("/me")).user;
    if (state.user) {
      appStore.getState().setUser(state.user);
    }
  } catch {
    // Non-blocking auth check
  }
  updateHeaderActions();

  catalog = createCatalog(
    state,
    (product, quantity) => cart.add(product, quantity),
    navigate,
  );
  cart = createCart(state);
  chat = createChat(state, catalog);
  admin = createAdmin(state);
  state.productEntry = createProductEntry(state, async () => {
    await state.reloadProducts();
  });

  applyConfig();
  catalog.render();
  cart.render();
  trackStorefrontEvent("page_view", { resultCount: state.products.length });
  await route();
  if (existingStore) {
    import("/storefront-auth.js").catch(() => {});
  }
} catch (error) {
  $("#storeName").textContent = "Loja Conflora";
  $("#logo").src = "/store-assets/brands/conflora-logo.png";
  $("#logo").alt = "Conflora Horta e Viveiro";
  $("#logo").hidden = false;
  $("#brand").classList.add("has-logo");
  $("#products").replaceChildren(
    element("p", { text: error.message, class: "error" }),
    element("button", {
      text: "common.retry".tr,
      onclick: () => location.reload(),
    }),
  );
}
