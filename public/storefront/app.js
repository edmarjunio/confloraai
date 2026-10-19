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
import { createPublicCache } from "./public-cache.mjs";

const existingStore = !location.pathname.startsWith("/shop/");
const slug = existingStore
  ? "conflora"
  : decodeURIComponent(location.pathname.split("/")[2]);
const basePath = existingStore ? "" : `/shop/${slug}`;
try {
  localStorage.removeItem("conflora:public-catalog:v1:main:conflora");
  localStorage.removeItem("conflora:public-catalog:v1:tenant:conflora");
  localStorage.removeItem("conflora_catalog_cache");
  localStorage.removeItem("conflora_catalog_cache_v2");
} catch {}
const publicCache = createPublicCache(existingStore ? "main:conflora:v3" : `tenant:${slug}:v3`);

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
  window.ConfloraSession.apiFetch("/api/analytics/events", {
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
let accountVersion = 0;
let accountOwner;
function updateHeaderActions() {
  const nextOwner = state.user?.id || null;
  if (accountOwner !== nextOwner) {
    accountOwner = nextOwner; accountVersion += 1;
    $('#historyDialog').close(); $('#ledgerContent').replaceChildren();
    document.querySelectorAll('.history-order-card').forEach(node => node.remove());
    Object.assign(historyState, { buffer: [], cursor: '', hasMore: false, loading: false, failed: false, loaded: false });
  }
  cart?.setOwner(state.user);
  const role = String(state.user?.role || "CLIENTE").toUpperCase();
  const isLoggedIn = Boolean(state.user);
  const allowedCashierRoles = ["ADMIN", "CAIXA", "VENDEDOR", "ENTREGADOR"];
  const identity = $("#headerAccountIdentity");

  identity.hidden = !isLoggedIn;
  $("#customerAccountShortcut").hidden = !isLoggedIn || !existingStore || (allowedCashierRoles.includes(role) && role !== 'ENTREGADOR');
  $('#customerDebtBadge').hidden = true;
  if (isLoggedIn && existingStore && ['CLIENTE', 'ENTREGADOR'].includes(role)) {
    const userId = state.user.id;
    state.api('/customer/ledger').then((ledger) => {
      if (state.user?.id === userId) updateDebtBadge(ledger.balance);
    }).catch(() => {});
  }
  $("#accountButton").hidden = isLoggedIn;
  $("#adminSettingsButton").hidden = false;
  if ($('#siteNavigationDrawer')?.open) window.ConfloraNavigation.open(state.user);
  cashierShortcut.hidden = !allowedCashierRoles.includes(role);
  const deliveryRole = role === 'ENTREGADOR';
  cashierShortcut.querySelector('span:first-child').replaceChildren(icon(deliveryRole ? 'truck' : 'register'));
  cashierShortcut.querySelector('span:last-child').textContent = deliveryRole ? 'MINHAS ENTREGAS' : 'CAIXA';
  cashierShortcut.setAttribute('aria-label', deliveryRole ? 'Minhas entregas' : 'Caixa');
  cashierShortcut.title = deliveryRole ? 'Minhas entregas' : 'Caixa';

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
$("#adminSettingsButton").addEventListener("click", () => window.ConfloraNavigation.open(state.user));

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
      document.querySelectorAll(".cf-back-button, [data-site-back]").forEach((btn) => {
        if (!btn.closest("#productView") && !btn.closest("#adminView")) {
          btn.remove();
        }
      });
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
state.persistPublicSnapshot = () => publicCache.write(state);
state.refreshCatalog = () => catalog?.render();
state.reloadProducts = async () => {
  // Query via TanStack Query cache invalidation
  queryClient.invalidateQueries({ queryKey: ["catalog"] });
  state.products = await storeQueries.getCatalog(slug, state.api);
  publicCache.write(state);
  catalog?.render();
  cart?.render();
};

function editOwnProfile() {
  if (!state.user || !existingStore) return;
  $('#accountTitle').textContent = 'Editar meu perfil';
  $('#accountSubtitle').textContent = 'Atualize seus dados pessoais. O e-mail continua vinculado ao seu login.';
  const form = element('form', { class: 'account-profile-form' });
  for (const [name, label, type] of [['name', 'Nome completo', 'text'], ['phone', 'WhatsApp com DDD', 'tel'], ['address', 'Endereço', 'text']]) {
    const input = element('input', { name, type, value: state.user[name] || '', ...(name === 'name' ? { required: '', maxlength: '120' } : {}) });
    form.append(element('label', { text: label }, [input]));
  }
  const status = element('p', { role: 'status' });
  const save = element('button', { type: 'submit', class: 'cf-button', text: 'Salvar meu perfil' });
  form.append(status, save);
  form.onsubmit = async event => {
    event.preventDefault(); save.disabled = true; status.textContent = '';
    try {
      const data = await state.api('/auth/profile', { method: 'PATCH', body: Object.fromEntries(new FormData(form)) });
      state.user = data.user; appStore.getState().setUser(data.user); updateHeaderActions();
      status.className = ''; status.textContent = 'Perfil atualizado.';
    } catch (error) { status.className = 'cf-error-banner'; status.textContent = error.message; }
    finally { save.disabled = false; }
  };
  $('#accountContent').replaceChildren(form);
}

async function account() {
  const content = $("#accountContent");
  content.replaceChildren();
  $("#googleAccount").hidden = !existingStore || !!state.user;
  if (state.user) {
    $("#accountTitle").textContent = "Sua conta";
    $("#accountSubtitle").textContent = "Escolha o que você precisa fazer agora.";
    content.className = "account-content account-signed-in";
    const name = state.user.name || state.user.email || "Cliente Conflora";
    const role = String(state.user.role || "CLIENTE").toUpperCase();
    const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const avatar = element("div", { class: "account-avatar", "aria-hidden": "true" }, [element("span", { text: initials })]);
    if (/^https:\/\//i.test(state.user.picture || '')) {
      const photo = element("img", { src: state.user.picture, alt: "", referrerpolicy: "no-referrer" });
      photo.onerror = () => photo.remove(); avatar.append(photo);
    }
    content.append(element("section", { class: "account-profile" }, [avatar,
      element("div", { class: "account-profile-copy" }, [
        element("span", { class: "account-profile-eyebrow", text: "VOCÊ ESTÁ CONECTADO" }),
        element("strong", { class: "account-greeting", text: name }),
        ...(state.user.email ? [element("span", { class: "account-email", text: state.user.email })] : []),
        element("span", { class: "account-role", text: role }),
      ]),
    ]));
    const actions = element("div", { class: "account-shortcuts" });
    const addShortcut = (title, description, symbol, onClick, featured = false) => {
      const button = element("button", { type: "button", class: "account-shortcut" + (featured ? " account-shortcut-featured" : ''), onclick: onClick }, [
        element("span", { class: "account-shortcut-icon" }, [icon(symbol)]),
        element("span", { class: "account-shortcut-copy" }, [element("strong", { text: title }), element("small", { text: description })]),
        icon("arrow"),
      ]);
      actions.append(button);
    };
    const openCashier = () => { $("#accountDialog").close(); location.assign("/caixa"); };
    if (existingStore && role === 'ENTREGADOR') addShortcut("Minhas entregas", "Aceite pedidos, abra a rota e confirme a entrega.", "truck", openCashier, true);
    else if (existingStore && ['ADMIN', 'CAIXA', 'VENDEDOR'].includes(role)) addShortcut(role === 'VENDEDOR' ? "Criar comanda" : "Ir para o caixa", "Acesse os produtos, comandas e atendimentos.", "register", openCashier, true);
    if (existingStore) addShortcut("Minha conta: saldo e histórico", "Consulte suas compras, pagamentos e saldo.", "history", () => { $("#accountDialog").close(); openPurchaseHistory(); }, role === 'CLIENTE');
    if (role === 'ADMIN' || (existingStore && role === 'CAIXA')) addShortcut(role === 'ADMIN' ? "Painel administrativo" : "Painel de vendas", role === 'ADMIN' ? "Gerencie produtos, equipe e resultados da loja." : "Acompanhe seus atendimentos e recebimentos.", "menu", () => existingStore ? location.assign('/admin') : navigate(`${basePath}/admin`));
    content.append(actions);
    content.append(element("div", { class: "account-session-footer" }, [
      element("span", { text: "Acesso pessoal à Conflora" }),
      element("button", {
        class: "account-logout", type: "button", text: "team.logout".tr,
        onclick: async (event) => {
          const button = event.currentTarget; button.disabled = true;
          try {
            await state.api("/auth/logout", { method: "POST" });
            if (existingStore && window.signOutGoogle) await window.signOutGoogle().catch(() => {});
            state.user = null; appStore.getState().setUser(null); catalog?.refreshFavorites(); updateHeaderActions();
            $("#accountDialog").close(); navigate(basePath || "/");
          } catch (error) { notify(error.message); }
          finally { button.disabled = false; }
        },
      }),
    ]));
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
        errorLabel.className = 'cf-error-banner';
        errorLabel.tabIndex = -1;
        errorLabel.focus();
        email.setAttribute('aria-invalid', String(/e-mail|email/i.test(error.message)));
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
const historyState = { buffer: [], cursor: "", hasMore: false, loading: false, failed: false, loaded: false };

function renderPurchase(order) {
  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Data não informada";
  const items = Array.isArray(order.items) ? order.items : [];
  const total = Number.isFinite(order.totalMinor) ? order.totalMinor : Math.round(Number(order.total || 0) * 100);
  const details = element("details", { class: "history-order-details" }, [
    element("summary", { text: "Ver detalhes da compra" }),
    element("div", { class: "history-order-meta" }, [
      element("span", { text: `Pagamento: ${order.paymentMethod || "Não informado"}` }),
      element("span", { text: order.paymentStatus === "ON_ACCOUNT" ? "Compra fiada — saldo registrado na conta" : order.paidAt ? `Pago em: ${new Date(order.paidAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Pagamento ainda não confirmado" }),
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
        element("strong", { text: `Pedido #${order.ticketNumber || String(order.id || "").slice(-8).toUpperCase()}` }),
        element("span", { class: "muted", text: createdAt }),
      ]),
      element("div", { class: "history-order-total" }, [
        element("strong", { text: money(total) }),
        element("span", { class: "badge", text: window.ConfloraOrderDisplay.status(order) }),
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
  if (historyState.loading || (!historyState.hasMore && historyState.loaded)) return;
  const version = accountVersion;
  historyState.loading = true;
  historySentinel.textContent = "Carregando mais compras…";
  try {
    const query = new URLSearchParams({ limit: "12" });
    if (historyState.cursor) query.set("cursor", historyState.cursor);
    const page = await state.api(`/customer/orders?${query}`);
    if (version !== accountVersion) return;
    historyState.buffer.push(...(page.orders || []));
    historyState.cursor = page.nextCursor || "";
    historyState.hasMore = Boolean(page.hasMore);
    historyState.loaded = true;
    historyState.failed = false;
    if (!historyState.buffer.length && historyState.hasMore) {
      historyState.loading = false;
      return loadHistoryPage();
    }
    renderHistoryBatch();
  } catch (error) {
    if (version !== accountVersion) return;
    historyState.failed = true;
    historySentinel.replaceChildren(element("button", { type: "button", class: "quiet", text: "Tentar novamente", onclick: () => { historyState.failed = false; loadHistoryPage(); } }));
    if (!historyList.querySelector(".history-order-card")) historyList.insertBefore(element("p", { class: "error", text: error.message }), historySentinel);
  } finally {
    if (version === accountVersion) {
      historyState.loading = false;
      if (!historyState.buffer.length && historyState.hasMore) loadHistoryPage();
      else if (!historyState.buffer.length) renderHistoryBatch();
    }
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
  historyState.loaded = false;
  historyList.replaceChildren(ledgerContent, element("h3", { class: "ledger-section-title", text: "Histórico de compras" }), historySentinel);
  historySentinel.textContent = "Carregando suas compras…";
  openDialog(historyDialog);
  loadCustomerLedger();
  if (!historyState.observer && typeof IntersectionObserver === "function") {
    historyState.observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !historyState.loading && !historyState.failed) {
        if (historyState.buffer.length) renderHistoryBatch();
        else if (historyState.hasMore || !historyState.loaded) loadHistoryPage();
      }
    }, { root: historyList, rootMargin: "140px" });
    historyState.observer.observe(historySentinel);
  }
  loadHistoryPage();
}

const ledgerContent = $("#ledgerContent");
function updateDebtBadge(balance) {
  const badge = $('#customerDebtBadge');
  badge.hidden = !(Number(balance) > 0);
  badge.textContent = Number(balance) > 0 ? `Deve ${money(Math.round(Number(balance) * 100))}` : '';
}
let debtPixTimer;
historyDialog.addEventListener('close', () => clearTimeout(debtPixTimer));

function renderDebtPayment(ledger) {
  const version = accountVersion;
  const section = element('section', { class: 'ledger-payment' });
  if (Number(ledger.balance) > 0 && state.config?.checkout?.pix?.mode !== 'SICREDI') {
    section.append(element('p', { role: 'status', text: 'Para quitar sua dívida por Pix, fale com a loja. O caixa confere o recebimento e atualiza seu saldo.' }));
  }
  if (Number(ledger.balance) > 0 && state.config?.checkout?.pix?.mode === 'SICREDI') {
    const amount = element('input', { type: 'number', min: '0.01', max: String(ledger.balance), step: '0.01', value: Number(ledger.balance).toFixed(2), 'aria-label': 'Valor da dívida a pagar' });
    const status = element('p', { role: 'status', class: 'muted' });
    const result = element('div');
    let operation;
    const poll = async (id) => {
      if (!historyDialog.open || !state.user || version !== accountVersion) return;
      try {
        const { charge } = await state.api('/customer/debt-pix/' + id);
        if (version !== accountVersion) return;
        if (charge.status === 'PAID') {
          status.textContent = 'Pagamento confirmado pelo Sicredi. Seu saldo foi atualizado.';
          clearTimeout(debtPixTimer);
          await loadCustomerLedger();
          ledgerContent.prepend(element('p', { class: 'ledger-balance ledger-balance--clear', role: 'status', text: 'Pagamento confirmado! Dívida atualizada automaticamente.' }));
          return;
        }
      } catch { status.textContent = 'Aguardando confirmação. Você pode reabrir Minha conta para conferir o saldo.'; }
      debtPixTimer = setTimeout(() => poll(id), 5000);
    };
    const pay = element('button', { type: 'button', class: 'primary', text: 'Pagar dívida com Pix', onclick: async () => {
      const value = Number(amount.value);
      if (!Number.isFinite(value) || value <= 0 || value > Number(ledger.balance)) { status.textContent = 'Informe um valor entre R$ 0,01 e o saldo devedor.'; return; }
      pay.disabled = true;
      amount.disabled = true;
      if (!operation || operation.amount !== value) operation = { amount: value, requestId: crypto.randomUUID() };
      status.textContent = 'Gerando cobrança Sicredi…';
      try {
        const { charge } = await state.api('/customer/debt-pix', { method: 'POST', body: operation });
        if (version !== accountVersion) return;
        if (charge.status === 'PAID') { await poll(charge.id); return; }
        result.replaceChildren(element('img', { src: charge.pixData.qrCodeBase64, alt: 'QR Code Pix para pagamento da dívida', width: '220', height: '220' }), element('textarea', { readonly: '', 'aria-label': 'Pix copia e cola da dívida', text: charge.pixData.pixCopiaECola }), element('button', { type: 'button', class: 'quiet', text: 'Copiar Pix', onclick: () => navigator.clipboard.writeText(charge.pixData.pixCopiaECola).then(() => { status.textContent = 'Pix copiado. Aguardando pagamento.'; }).catch(() => { status.textContent = 'Selecione e copie o código acima.'; }) }));
        status.textContent = 'Pague pelo seu banco. A baixa será automática após a confirmação do Sicredi.';
        poll(charge.id);
      } catch (error) {
        status.textContent = error.message;
        pay.disabled = false;
        amount.disabled = false;
      }
    } });
    section.append(element('label', { text: 'Quanto deseja pagar? (R$)' }, [amount]), pay, status, result);
  }
  const phone = String(ledger.supportPhone || state.config?.checkout?.contactPhone || '').replace(/\D/g, '');
  section.append(element('p', { class: 'muted', text: 'Encontrou algo errado no saldo ou em uma compra?' }));
  if (/^\d{10,15}$/.test(phone)) section.append(element('a', { class: 'quiet', text: 'Falar com a loja', href: `https://wa.me/${phone.length <= 11 ? '55' + phone : phone}?text=${encodeURIComponent('Olá! Preciso de ajuda para conferir minha conta e histórico na Conflora.')}`, target: '_blank', rel: 'noopener noreferrer' }));
  else section.append(element('p', { class: 'muted', text: 'Peça a um representante da loja para conferir seu cadastro e as movimentações.' }));
  ledgerContent.append(section);
}

function renderCustomerLedger(ledger) {
  updateDebtBadge(ledger.balance);
  clearTimeout(debtPixTimer);
  ledgerContent.replaceChildren();
  const balance = Number(ledger.balance || 0);
  const balanceTitle = balance > 0 ? "Saldo devedor" : balance < 0 ? "Crédito a seu favor" : "Saldo quitado";
  const balanceTone = balance > 0 ? "ledger-balance--debt" : balance < 0 ? "ledger-balance--credit" : "ledger-balance--clear";
  ledgerContent.append(element("section", { class: `ledger-balance ${balanceTone}` }, [
    element("span", { class: "muted", text: `Olá, ${ledger.customerName || state.user?.name || "cliente"}` }),
    element("strong", { text: balanceTitle }),
    element("span", { class: "ledger-balance-value", text: money(Math.abs(Math.round(balance * 100))) }),
  ]));
  const creditBalance = Number(ledger.creditBalance || 0);
  if (creditBalance > 0) ledgerContent.append(element("section", { class: 'ledger-balance ledger-balance--credit' }, [
    element("span", { class: "muted", text: "Valores recebidos antecipadamente" }),
    element("strong", { text: creditBalance > 0 ? "Crédito a seu favor" : "Crédito disponível" }),
    element("span", { class: "ledger-balance-value", text: money(Math.max(0, Math.round(creditBalance * 100))) }),
  ]));
  renderDebtPayment(ledger);

  const transactions = [...(ledger.transactions || [])].sort((left, right) =>
    String(right.createdAt || "").localeCompare(String(left.createdAt || "")),
  );
  ledgerContent.append(element("h3", { class: "ledger-section-title", text: "Movimentações" }));
  if (!transactions.length) {
    ledgerContent.append(element("p", { class: "muted", text: "Ainda não há compras fiadas ou recebimentos vinculados a este cadastro." }));
    return;
  }
  for (const transaction of transactions) {
    const isDebt = transaction.type === "DEBITO_FIADO";
    const isCredit = transaction.entryType === "CREDITO_CLIENTE" || transaction.type === "CREDITO_CLIENTE";
    const isCreditUse = transaction.entryType === "USO_CREDITO" || transaction.type === "USO_CREDITO";
    const amount = Math.abs(Math.round(Number(transaction.amount || 0) * 100));
    const title = isDebt ? "Compra fiada" : isCredit ? "Crédito recebido" : isCreditUse ? "Crédito usado em compra" : "Recebimento de fiado";
    const prefix = isDebt || isCredit ? "+ " : "− ";
    const date = transaction.createdAt ? new Date(transaction.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Data não informada";
    const meta = [date, transaction.paymentMethod, transaction.ticketNumber ? `Venda #${transaction.ticketNumber}` : transaction.orderId ? `Pedido #${String(transaction.orderId).slice(-8).toUpperCase()}` : "", transaction.receivedBy ? `Atendido por ${transaction.receivedBy}` : ""]
      .filter(Boolean).join(" · ");
    const card = element("article", { class: "ledger-transaction" }, [
      element("div", {}, [element("strong", { text: title }), element("span", { class: "muted", text: meta })]),
      element("strong", { class: isDebt ? "ledger-amount--debt" : isCreditUse ? "ledger-amount--debt" : "ledger-amount--credit", text: prefix + money(amount) }),
    ]);
    if (transaction.items?.length) {
      card.append(element("span", { class: "ledger-transaction-items", text: transaction.items.map((item) => `${item.quantity} ${item.unit || "UN"} · ${item.name}`).join(" · ") }));
    }
    if (transaction.type === "QUITACAO_FIADO") {
      card.append(element("span", { class: "muted", text: `Saldo devedor após o pagamento: ${money(Math.round(Number(transaction.newBalance || 0) * 100))}` }));
    }
    if (transaction.receiptText) {
      card.append(element("details", { class: "ledger-receipt" }, [
        element("summary", { text: "Ver recibo da compra" }),
        window.ConfloraOrderDisplay.renderText(transaction.receiptText),
      ]));
    }
    ledgerContent.append(card);
  }
}

async function loadCustomerLedger() {
  if (!state.user) {
    notify("Entre na sua conta para consultar seu saldo.");
    return;
  }
  const version = accountVersion;
  ledgerContent.replaceChildren(element("p", { class: "muted", text: "Carregando seu saldo…" }));
  try {
    const ledger = await state.api("/customer/ledger");
    if (version !== accountVersion) return;
    renderCustomerLedger(ledger);
  } catch (error) {
    if (version !== accountVersion) return;
    ledgerContent.replaceChildren(element("p", { class: "error", role: "alert", text: error.message }));
    if (error.status === 404) {
      ledgerContent.append(element("p", { class: "muted", text: "Para vincular sua conta, informe ao caixa o mesmo e-mail usado no seu login. A equipe consegue atualizar o cadastro na tela do caixa." }));
    } else {
      ledgerContent.append(element("button", { type: "button", class: "quiet", text: "Tentar novamente", onclick: loadCustomerLedger }));
    }
  }
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
$("#customerAccountShortcut").addEventListener("click", openPurchaseHistory);
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
let catalogRefresh;
let lastCatalogRefresh = 0;
async function refreshPublicCatalog() {
  if (catalogRefresh) return catalogRefresh;
  lastCatalogRefresh = Date.now();
  catalogRefresh = (async () => {
    const [config, products] = await Promise.all([
      state.api("/config"), state.api("/products"),
    ]);
    publicCache.write({ config, products });
    const changed = JSON.stringify([state.config, state.products]) !== JSON.stringify([config, products]);
    if (!changed) return;
    state.config = config;
    state.products = products;
    queryClient.setQueryData(["catalog", slug], products);
    applyConfig();
    catalog.render();
    cart.render();
    // Update a product page without replacing an open administrative form.
    if (location.pathname.includes("/products/")) await route();
  })();
  try {
    await catalogRefresh;
  } finally {
    catalogRefresh = null;
  }
}

try {
  // Apply initial HTML translations immediately
  applyHtmlTranslations();

  const session = state.api("/me").catch(() => ({ user: null }));
  const saved = publicCache.read();
  if (saved) {
    state.config = saved.config;
    state.products = saved.products;
    queryClient.setQueryData(["catalog", slug], saved.products);
  } else {
    [state.config, state.products] = await Promise.all([
      state.api("/config"), storeQueries.getCatalog(slug, state.api),
    ]);
    publicCache.write(state);
    lastCatalogRefresh = Date.now();
  }

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
  const topbarIntent = new URLSearchParams(location.search);
  if (topbarIntent.has('q')) {
    const query = topbarIntent.get('q');
    if (!/@/.test(query)) {
      $('#search').value = query;
      catalog.render();
    }
  } else if ($('#search') && /@/.test($('#search').value)) {
    $('#search').value = '';
    catalog.render();
  }

  if (saved) refreshPublicCatalog().catch(() => {});
  // Login resolution does not block the public catalogue or its first render.
  session.then(async ({ user }) => {
    state.user = user || null;
    appStore.getState().setUser(state.user);
    updateHeaderActions();
    if (topbarIntent.has('sacola')) cart.open();
      if (topbarIntent.has('conta')) account().then(() => { if (topbarIntent.has('editar')) editOwnProfile(); }).catch(error => notify(error.message));
    catalog.refreshFavorites();
    if (/\/(admin|configuracoes)\/?$/.test(location.pathname)) await route();
  }).catch(() => {});
  const refreshOnReturn = () => {
    if (document.visibilityState === "visible" && Date.now() - lastCatalogRefresh > 60000) {
      refreshPublicCatalog().catch(() => {});
    }
  };
  document.addEventListener("visibilitychange", refreshOnReturn);
  window.addEventListener("online", refreshOnReturn);
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("/storefront/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }
  if (existingStore) {
    import("/storefront-auth.js").catch(() => {});
  }
} catch (error) {
  $("#storeName").textContent = "Loja Conflora";
  $("#logo").src = "/store-assets/brands/conflora-logo.png";
  $("#logo").alt = "Conflora Horta e Viveiro";
  $("#logo").hidden = false;
  $("#brand").classList.add("has-logo");
  const isNetwork = error.message?.includes("fetch") || error.name === "TypeError";
  const errorMessage = isNetwork
    ? "Conectando ao catálogo... Se não carregar em instantes, clique para tentar novamente."
    : error.message;
  $("#products").replaceChildren(
    element("p", { text: errorMessage, class: "error" }),
    element("button", {
      text: "common.retry".tr,
      onclick: () => location.reload(),
    }),
  );
  if (isNetwork) {
    setTimeout(() => location.reload(), 3500);
    window.addEventListener("online", () => location.reload(), { once: true });
  }
}
