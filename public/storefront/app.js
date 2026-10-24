import {
  $,
  element,
  createApi,
  openDialog,
  notify,
  money,
} from "./ui.js";
import { createSearchAutocomplete } from "./search-autocomplete.js";
import { createCustomerOrderNotifications } from "./customer-order-notifications.js";
import { createCatalog } from "./catalog.js";
import { createCart } from "./cart.js";
import { createChat } from "./chat.js";
import { createExistingApi } from "./existing-api.js";
import { icon } from "./icons.js";
import {
  getLanguage,
  setLanguage,
  applyHtmlTranslations,
  onLanguageChange,
} from "./i18n/index.js";
import { appStore } from "./store/index.js";
import { createPublicCatalog, PUBLIC_FRESH_TIME } from './public-catalog.mjs';
import { renderOrderReceipt } from "./receipt.js";
import { startPerformanceMonitor } from "./performance.mjs";
import { createPurchaseInsights } from "./purchase-insights.mjs";
import { createOrderFeedback } from "./order-feedback.js";

const existingStore = !location.pathname.startsWith("/shop/");
// Authentication is independent of catalogue requests and secondary resources.
if (existingStore) import('/storefront-auth.js').catch(() => {
  const status = document.querySelector('[data-google-status]');
  if (status) status.textContent = 'Login Google indisponível. Recarregue ou utilize e-mail e senha.';
});
const performanceMonitor = startPerformanceMonitor();
const shellLogoUrl = $('#logo').getAttribute('src') || '/store-assets/brands/conflora-logo.webp';
const slug = existingStore
  ? "conflora"
  : decodeURIComponent(location.pathname.split("/")[2]);
const basePath = existingStore ? "" : `/shop/${slug}`;
// Persist only the audited main store's public projection, never tenant/private APIs.
const publicCatalog = existingStore ? createPublicCatalog('main:conflora') : null;
let catalogSource = 'network';
function catalogStatus(message) {
  let status = document.getElementById('catalogSyncStatus');
  if (!status) {
    status = element('p', { id: 'catalogSyncStatus', role: 'status', class: 'muted' });
    document.getElementById('products').before(status);
  }
  status.textContent = message;
  status.hidden = !message;
}

const state = {
  existingStore,
  slug,
  basePath,
  api: existingStore ? createExistingApi() : createApi(slug),
  config: null,
  products: [],
  user: null,
};
let catalogRevision = 0;
function invalidateVisibleCatalog() {
  catalogRevision++;
  publicCatalog?.invalidate();
  lastCatalogRefresh = 0;
  nextCatalogRetry = 0;
  catalogSource = 'cache';
  // Wait for any older request to finish before starting the authoritative read.
  if (catalog) {
    setTimeout(async () => {
      await catalogRefresh?.catch(() => {});
      if (document.visibilityState === 'visible') refreshPublicCatalog().catch(() => {});
    }, 0);
  }
}
window.addEventListener('cf-catalog-invalidated', invalidateVisibleCatalog);
window.addEventListener('storage', event => {
  if (event.key === 'cf-public-invalidated') invalidateVisibleCatalog();
});
const transport = state.api;
state.api = async (path, options = {}) => {
  const result = await transport(path, options);
  if (!existingStore && options.method && !['GET', 'HEAD'].includes(options.method) && /(?:products|stock|orders|config|inventory)/.test(path)) {
    catalogRevision++;
    publicCatalog?.invalidate();
    // Keep the receipt/checkout in place; refresh the public display in the background.
    lastCatalogRefresh = 0;
    setTimeout(async () => {
      await catalogRefresh?.catch(() => {});
      refreshPublicCatalog().catch(() => {});
    }, 0);
  }
  return result;
};

state.purchaseInsights = createPurchaseInsights(state);
state.orderNotifications = createCustomerOrderNotifications(state, (id) => openPurchaseHistory(id));
createSearchAutocomplete(state);

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
  // Checkout success creates an order; only the backend can establish payment.
  if (eventName === "purchase") eventName = "order_created";
  const label = value => /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(value || "") && !/\d{7}/.test(value) ? value : "";
  const event = {
    id: crypto.randomUUID(),
    eventName,
    visitorId: analyticsVisitorId,
    utmSource: label(analyticsCampaign.get("utm_source")),
    utmMedium: label(analyticsCampaign.get("utm_medium")),
    utmCampaign: label(analyticsCampaign.get("utm_campaign")),
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
      price: entry.value,
      quantity: entry.quantity,
    })) : event.productId ? [{
      item_id: event.productId,
      price: event.value,
    }] : undefined;
    window.gtag("event", eventName, {
      event_id: event.id,
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
state.analyticsClientId = analyticsVisitorId;

if (existingStore) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", "G-TX7SZBP9J8", {
    send_page_view: false,
    client_id: analyticsVisitorId,
    page_location: location.origin + "/",
    page_referrer: "",
    page_title: 'conflora_catalog'.tr,
    campaign_source: /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(analyticsCampaign.get("utm_source") || "") && !/\d{7}/.test(analyticsCampaign.get("utm_source")) ? analyticsCampaign.get("utm_source") : "",
    campaign_medium: /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(analyticsCampaign.get("utm_medium") || "") && !/\d{7}/.test(analyticsCampaign.get("utm_medium")) ? analyticsCampaign.get("utm_medium") : "",
    campaign_name: /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(analyticsCampaign.get("utm_campaign") || "") && !/\d{7}/.test(analyticsCampaign.get("utm_campaign")) ? analyticsCampaign.get("utm_campaign") : "",
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const analyticsScript = document.createElement("script");
  analyticsScript.async = true;
  analyticsScript.src = "https://www.googletagmanager.com/gtag/js?id=G-TX7SZBP9J8";
  document.head.append(analyticsScript);
}

const cashierShortcut = $("#cashierShortcut");
const guideShortcut = $("#guideShortcut");
let accountVersion = 0;
let accountOwner;
function updateHeaderActions() {
  const nextOwner = state.user?.id || null;
  if (accountOwner !== nextOwner) {
    accountOwner = nextOwner; accountVersion += 1;
    state.purchaseInsights.invalidate();
    $('#historyDialog').close(); $('#ledgerContent').replaceChildren();
    document.querySelectorAll('.history-order-card').forEach(node => node.remove());
    Object.assign(historyState, { buffer: [], cursor: '', hasMore: false, loading: false, failed: false, loaded: false });
  }
  cart?.setOwner(state.user);
  state.orderNotifications.setUser(state.user);
  const role = String(state.user?.role || "CLIENTE").toUpperCase();
  const isLoggedIn = Boolean(state.user);
  const allowedCashierRoles = ["ADMIN", "CAIXA", "VENDEDOR", "ENTREGADOR"];
  const identity = $("#headerAccountIdentity");

  identity.hidden = !isLoggedIn;
  $("#customerAccountShortcut").hidden = !isLoggedIn || !existingStore || allowedCashierRoles.includes(role);
  $('#customerDebtBadge').hidden = true;
  if (isLoggedIn && existingStore && ['CLIENTE', 'ENTREGADOR'].includes(role)) {
    const userId = state.user.id;
    state.api('/customer/ledger').then((ledger) => {
      if (state.user?.id === userId) updateDebtBadge(ledger.balance);
    }).catch(() => {});
  }
  if (isLoggedIn && existingStore) {
    orderFeedback?.checkPendingDeliveredOrder();
  } else {
    orderFeedback?.hideFloatingPrompt();
  }
  $("#accountButton").hidden = isLoggedIn;
  $("#adminSettingsButton").hidden = false;
  if ($('#siteNavigationDrawer')?.open) window.ConfloraNavigation.open(state.user);
  cashierShortcut.hidden = !allowedCashierRoles.includes(role);
  const deliveryRole = role === 'ENTREGADOR';
  cashierShortcut.querySelector('span:first-child').replaceChildren(icon(deliveryRole ? 'truck' : 'register'));
  cashierShortcut.querySelector('span:last-child').textContent = (deliveryRole ? 'deliveries'.tr : "CAIXA").tr;
  cashierShortcut.setAttribute('aria-label', (deliveryRole ? 'header_my_deliveries'.tr : 'checkout'.tr).tr);
  cashierShortcut.title = (deliveryRole ? 'header_my_deliveries'.tr : 'checkout'.tr).tr;

  const guideText = guideShortcut?.querySelector('span:last-child');
  if (guideText) guideText.textContent = 'header_guide'.tr;
  const custAccountText = $("#customerAccountShortcut")?.querySelector('span:last-child');
  if (custAccountText) custAccountText.textContent = 'header_my_account'.tr;
  if (guideShortcut) {
    const isTeamMember = isLoggedIn && allowedCashierRoles.includes(role);
    guideShortcut.hidden = !isTeamMember;
    if (isTeamMember) {
      const guideMap = {
        ADMIN: '/guias/admin.html',
        CAIXA: '/guias/caixa.html',
        VENDEDOR: '/guias/vendedor.html',
        ENTREGADOR: '/guias/entregador.html',
      };
      const targetGuide = guideMap[role] || '/guias/index.html';
      guideShortcut.href = targetGuide;
      guideShortcut.title = `Guia Operacional - ${role}`;
      guideShortcut.setAttribute('aria-label', `${'operational_guide_of'.tr} ${role}`);
    }
  }

  if (isLoggedIn) {
    $("#headerAccountName").textContent =
      state.user.name || state.user.email || 'user'.tr;
    $("#headerAccountRole").textContent = role;
    identity.setAttribute(
      "aria-label",
      `${'open_account_of'.tr} ${state.user.name || 'user_c41973'.tr} (${role})`,
    );
  }
}
window.state = state;
window.updateHeaderActions = updateHeaderActions;
cashierShortcut.addEventListener("click", () => location.assign("/caixa"));
if (guideShortcut) {
  guideShortcut.addEventListener("click", (e) => {
    const userRole = String(state.user?.role || "").toUpperCase();
    const guideMap = {
      ADMIN: '/guias/admin.html',
      CAIXA: '/guias/caixa.html',
      VENDEDOR: '/guias/vendedor.html',
      ENTREGADOR: '/guias/entregador.html',
    };
    if (guideMap[userRole]) {
      e.preventDefault();
      location.assign(guideMap[userRole]);
    }
  });
}
$("#adminSettingsButton").addEventListener("click", () => window.ConfloraNavigation.open(state.user));

let catalog;
let cart;
let chat;
let admin;
let orderFeedback;

function navigate(path) {
  history.replaceState({ ...history.state, scrollY: window.scrollY }, "");
  for (const dialog of document.querySelectorAll("dialog[open]")) {
    dialog.close();
  }
  history.pushState({ scrollY: 0 }, "", path);
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
  document.title = state.config.identity?.name || 'store'.tr;
  try {
    if (isAdmin) {
      admin ||= import("./admin.js").then(({ createAdmin }) => createAdmin(state));
      await (await admin).render();
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

  $("#storeName").textContent = config.identity?.name || 'store'.tr;
  $("#subtitle").textContent = config.identity?.subtitle || "";
  $("#region").textContent = [config.identity?.city, config.identity?.region]
    .filter(Boolean)
    .join(" · ");
  const logoUrl = existingStore
    ? shellLogoUrl
    : config.branding?.logoUrl || shellLogoUrl;
  const logo = $("#logo");
  const defaultLogoUrl = shellLogoUrl;
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
  logo.alt = existingStore ? 'conflora_garden_nursery'.tr : config.identity?.name || "";
  $("#storeIcon").href = config.branding?.iconUrl || "data:,";
  $("#brand").href = basePath || "/";

  cart?.configure();
  chat?.configure();
  applyHtmlTranslations();
}

state.applyConfig = applyConfig;

state.refreshCatalog = () => catalog?.render();
state.reloadProducts = async () => {
  catalogRevision++;
  publicCatalog?.invalidate();
  lastCatalogRefresh = 0;
  nextCatalogRetry = 0;
  await catalogRefresh?.catch(() => {});
  return refreshPublicCatalog();
};

function editOwnProfile() {
  if (!state.user || !existingStore) return;
  $('#accountTitle').removeAttribute('data-i18n');
  $('#accountTitle').textContent = 'edit_my_profile'.tr;
  $('#accountSubtitle').textContent = 'update_your_personal_details_your_email_remains_linked_to_your_login'.tr;
  const form = element('form', { class: 'account-profile-form' });
  for (const [name, label, type] of [['name', 'full_name'.tr, 'text'], ['phone', 'whatsapp_with_area_code'.tr, 'tel'], ['address', 'address'.tr, 'text']]) {
    const input = element('input', { name, type, value: state.user[name] || '', ...(name === 'name' ? { required: '', maxlength: '120' } : {}) });
    form.append(element('label', { text: label }, [input]));
  }
  const status = element('p', { role: 'status' });
  const save = element('button', { type: 'submit', class: 'cf-button', text: 'save_my_profile'.tr });
  form.append(status, save);
  form.onsubmit = async event => {
    event.preventDefault(); save.disabled = true; status.textContent = '';
    try {
      const data = await state.api('/auth/profile', { method: 'PATCH', body: Object.fromEntries(new FormData(form)) });
      state.user = data.user; appStore.getState().setUser(data.user); updateHeaderActions();
      status.className = ''; status.textContent = 'profile_updated'.tr;
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
    $("#accountTitle").removeAttribute('data-i18n');
    $("#accountTitle").textContent = 'your_account'.tr;
    $("#accountSubtitle").textContent = 'choose_what_you_need_to_do_now'.tr;
    content.className = "account-content account-signed-in";
    const name = state.user.name || state.user.email || 'conflora_customer'.tr;
    const role = String(state.user.role || "CLIENTE").toUpperCase();
    const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const avatar = element("div", { class: "account-avatar", "aria-hidden": "true" }, [element("span", { text: initials })]);
    if (/^https:\/\//i.test(state.user.picture || '')) {
      const photo = element("img", { src: state.user.picture, alt: "", referrerpolicy: 'no_referrer'.tr });
      photo.onerror = () => photo.remove(); avatar.append(photo);
    }
    content.append(element("section", { class: "account-profile" }, [avatar,
      element("div", { class: "account-profile-copy" }, [
        element("span", { class: "account-profile-eyebrow", text: 'you_are_logged_in'.tr }),
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
    if (existingStore && role === 'ENTREGADOR') addShortcut('header_my_deliveries'.tr, 'accept_orders_open_the_route_and_confirm_delivery'.tr, "truck", openCashier, true);
    else if (existingStore && ['ADMIN', "CAIXA", 'VENDEDOR'].includes(role)) addShortcut(role === 'VENDEDOR' ? "Criar comanda" : 'go_to_checkout'.tr, 'access_products_tabs_and_customer_service'.tr, "register", openCashier, true);
    if (existingStore) addShortcut('my_account_balance_and_history'.tr, "Consulte suas compras, pagamentos e saldo.", "history", () => { $("#accountDialog").close(); openPurchaseHistory(); }, role === 'CLIENTE');
    if (role === 'ADMIN' || (existingStore && role === 'CAIXA')) addShortcut(role === 'ADMIN' ? "Painel administrativo" : 'sales_dashboard'.tr, role === 'ADMIN' ? 'manage_products_team_and_store_results'.tr : "Acompanhe seus atendimentos e recebimentos.", "menu", () => existingStore ? location.assign('/admin') : navigate(`${basePath}/admin`));
    content.append(actions);
    content.append(element("div", { class: "account-session-footer" }, [
      element("span", { text: 'personal_access_to_conflora'.tr }),
      element("button", {
        class: "account-logout", type: "button", text: 'team_logout'.tr,
        onclick: async (event) => {
          const button = event.currentTarget; button.disabled = true;
          try {
            await state.api("/auth/logout", { method: "POST" });
            if (existingStore && window.signOutGoogle) await window.signOutGoogle().catch(() => {});
            state.user = null; appStore.getState().setUser(null); updateHeaderActions(); catalog?.refreshPurchases();
            $("#accountDialog").close(); navigate(basePath || "/");
          } catch (error) { notify(error.message); }
          finally { button.disabled = false; }
        },
      }),
    ]));
  } else {
    $("#accountTitle").removeAttribute('data-i18n');
    $("#accountTitle").textContent = 'sign_in_to_your_account'.tr;
    $("#accountSubtitle").textContent = 'access_your_orders_and_enjoy_a_more_practical_shopping_experience'.tr;
    content.className = "account-content account-signed-out";
    const form = element("form", { class: "account-form" });
    const mode = element("select", { "aria-label": 'header_login'.tr }, [
      element("option", { value: "login", text: 'header_login'.tr }),
      element("option", { value: "register", text: 'register_779d4c'.tr }),
    ]);
    const name = element("input", {
      name: "name",
      placeholder: 'cart_name_label'.tr,
      autocomplete: "name",
      maxlength: "100",
    });
    const nameLabel = element("label", { text: 'cart_name_label'.tr }, [name]);
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
      button.textContent = mode.value === "register" ? 'create_my_account'.tr : 'header_login'.tr;
    });
    const button = element("button", {
      type: "submit",
      class: "primary",
      text: 'header_login'.tr,
    });
    mode.classList.add("account-mode");
    const errorLabel = element("p", { class: "error", role: "alert" });
    form.append(
      mode,
      nameLabel,
      element("label", { text: 'e_mail'.tr }, [email]),
      element("label", { text: 'password'.tr }, [password]),
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
        updateHeaderActions();

        catalog?.refreshPurchases();
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
  status.textContent = 'connecting_with_your_google_account'.tr;
  try {
    const result = await window.authenticateGoogle();
    if (!result?.success || !result.user) {
      throw new Error(result?.error || 'could_not_authenticate_your_account'.tr);
    }
    state.user = result.user;
    appStore.getState().setUser(state.user);
    updateHeaderActions();

    catalog?.refreshPurchases();
    $("#accountDialog").close();
    route();
  } catch (error) {
    status.textContent = error.message || 'could_not_sign_in_with_google_please_try_again'.tr;
  } finally {
    button.disabled = false;
  }
});

const historyDialog = $("#historyDialog");
const historyList = $("#historyList");
const historySentinel = $("#historyLoadSentinel");
const historyState = { buffer: [], cursor: "", hasMore: false, loading: false, failed: false, loaded: false };

const spendingSection = element('section', { class: 'spending-trends', 'aria-label': 'spending_trends'.tr });
let disposeSpendingChart;
let spendingRevision = 0;
async function renderSpendingTrends() {
  const revision = ++spendingRevision;
  const owner = state.user?.id;
  disposeSpendingChart?.();
  disposeSpendingChart = undefined;
  spendingSection.replaceChildren(element('h3', { text: 'spending_trends'.tr }), element('p', { role: 'status', text: 'loading_your_spending'.tr }));
  try {
    const [insights, chart] = await Promise.all([state.purchaseInsights.load(), import('./dist/spending-chart.js')]);
    if (revision !== spendingRevision || owner !== state.user?.id || !historyDialog.open) return;
    const host = element('div', { class: 'spending-chart' });
    const values = element('details', { class: 'spending-values' }, [element('summary', { text: 'view_monthly_amounts'.tr }),
      ...insights.months.map(month => element('p', { text: month.label + ': ' + money(month.amountMinor) })),
    ]);
    spendingSection.replaceChildren(element('h3', { text: 'spending_trends'.tr }),
      element('p', { class: 'muted', text: 'last_6_months_including_the_current_month_confirmed_purchases_including_store_credit_'.tr }), host, values);
    if (!insights.months.some(month => month.amountMinor > 0)) spendingSection.append(element('p', { text: 'no_spending_recorded_in_this_period'.tr }));
    disposeSpendingChart = chart.mountSpendingChart(host, insights.months);
  } catch (error) {
    if (revision !== spendingRevision || owner !== state.user?.id) return;
    spendingSection.replaceChildren(element('h3', { text: 'spending_trends'.tr }), element('p', { role: 'status', text: error.message }), element('button', { type: 'button', class: 'quiet', text: "try_again".tr, onclick: renderSpendingTrends }));
  }
}
historyDialog.addEventListener('close', () => { spendingRevision++; disposeSpendingChart?.(); disposeSpendingChart = undefined; });

function renderPurchase(order) {
  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : 'date_not_provided'.tr;
  const items = Array.isArray(order.items) ? order.items : [];
  const total = Number.isFinite(order.totalMinor) ? order.totalMinor : Math.round(Number(order.total || 0) * 100);
  const details = element("details", { class: "history-order-details" }, [
    element("summary", { text: 'view_purchase_details'.tr }),
    element("div", { class: "history-order-meta" }, [
      element("span", { text: `${'payment_b27182'.tr} ${order.paymentMethod || 'not_informed'.tr}` }),
      element("span", { text: order.paymentStatus === "ON_ACCOUNT" ? 'store_credit_purchase_balance_recorded_on_account'.tr : order.paidAt ? `${'paid_on'.tr} ${new Date(order.paidAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : 'payment_not_yet_confirmed'.tr }),
      element("span", { text: `${'delivery_cdbdf1'.tr} ${order.fulfillment === "delivery" ? 'address'.tr : order.fulfillment === "pickup" ? 'cart_pickup_option'.tr : order.deliveryAddress || 'not_informed'.tr}` }),
      ...(order.serviceArea ? [element("span", { text: `${'region'.tr} ${order.serviceArea}` })] : []),
      ...(order.deliveryAddress || order.address ? [element("span", { text: `${'address_e432ad'.tr} ${order.deliveryAddress || order.address}` })] : []),
      ...items.map((item) => element("span", { text: `${item.quantity || 1} × ${item.name || 'product'.tr} · ${money(Math.round(Number(item.price || 0) * Number(item.quantity || 1) * 100))}` })),
      renderOrderReceipt(order),
    ]),
  ]);
  const feedbackSection = orderFeedback?.renderOrderCardFeedback(order);
  return element("article", { class: "history-order-card", "data-order-id": order.id }, [
    element("div", { class: "history-order-summary" }, [
      element("div", {}, [
        element("strong", { text: `${'order_033893'.tr}${order.ticketNumber || String(order.id || "").slice(-8).toUpperCase()}` }),
        element("span", { class: "muted", text: createdAt }),
      ]),
      element("div", { class: 'history_order_total'.tr }, [
        element("strong", { text: money(total) }),
        element("span", { class: "badge", text: window.ConfloraOrderDisplay.status(order) }),
      ]),
    ]),
    element("p", { class: "history-order-items", text: `${items.length} ${items.length === 1 ? "item" : 'mobile_cart_items'.tr} · ${items.slice(0, 3).map((item) => item.name || 'product'.tr).join(", ")}${items.length > 3 ? "…" : ""}` }),
    feedbackSection,
    details,
  ]);
}

function renderHistoryBatch() {
  const nextOrders = historyState.buffer.splice(0, 6);
  for (const order of nextOrders) {
    const card = renderPurchase(order);
    historyList.insertBefore(card, historySentinel);
    if (order.id === historyState.focusOrderId) {
      card.querySelector('details').open = true;
      card.scrollIntoView({ block: 'nearest' });
      historyState.focusOrderId = '';
    }
  }
  if (!historyList.querySelector(".history-order-card") && !historyState.loading && !historyState.hasMore && !historyState.failed) {
    historyList.insertBefore(element("p", { class: "muted", text: 'you_have_no_purchases_linked_to_this_account_yet'.tr }), historySentinel);
  }
  if (historyState.focusOrderId && historyState.buffer.length) window.setTimeout(renderHistoryBatch, 0);
  if (!historyState.buffer.length && historyState.hasMore && !historyState.loading) loadHistoryPage();
  if (!historyState.buffer.length && !historyState.hasMore && !historyState.loading) historySentinel.replaceChildren();
}

async function loadHistoryPage() {
  if (historyState.loading || (!historyState.hasMore && historyState.loaded)) return;
  const version = accountVersion;
  historyState.loading = true;
  historySentinel.textContent = 'loading_more_purchases'.tr;
  try {
    const query = new URLSearchParams({ limit: "12" });
    if (historyState.cursor) query.set("cursor", historyState.cursor);
    const page = state.existingStore ? await state.api(`/customer/orders?${query}`) : { orders: await state.api('/orders'), hasMore: false };
    if (version !== accountVersion) return;
    historyState.buffer.push(...(page.orders || []));
    orderFeedback?.inspectLoadedOrders(page.orders || []);
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
    historySentinel.replaceChildren(element("button", { type: "button", class: "quiet", text: 'try_again'.tr, onclick: () => { historyState.failed = false; loadHistoryPage(); } }));
    if (!historyList.querySelector(".history-order-card")) historyList.insertBefore(element("p", { class: "error", text: error.message }), historySentinel);
  } finally {
    if (version === accountVersion) {
      historyState.loading = false;
      if (!historyState.buffer.length && historyState.hasMore) loadHistoryPage();
      else if (!historyState.buffer.length) renderHistoryBatch();
    }
  }
}

function openPurchaseHistory(orderId = "") {
  historyState.focusOrderId = typeof orderId === "string" ? orderId : "";
  if (!state.user) {
    notify('sign_in_to_your_account_to_view_your_history'.tr);
    return;
  }
  historyState.buffer = [];
  historyState.cursor = "";
  historyState.hasMore = false;
  historyState.loading = false;
  historyState.failed = false;
  historyState.loaded = false;
  historyList.replaceChildren(state.orderNotifications.button(), spendingSection, ledgerContent, element("h3", { class: "ledger-section-title", text: 'purchase_history'.tr }), historySentinel);
  historySentinel.textContent = 'loading_your_purchases_088d4c'.tr;
  openDialog(historyDialog);
  ledgerContent.hidden = !state.existingStore;
  if (state.existingStore) loadCustomerLedger();
  renderSpendingTrends();
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
    section.append(element('p', { role: 'status', text: 'to_pay_your_debt_via_pix_contact_the_store_cashier_will_check_the_receipt_and_update_'.tr }));
  }
  if (Number(ledger.balance) > 0 && state.config?.checkout?.pix?.mode === 'SICREDI') {
    const amount = element('input', { type: 'number', min: '0.01', max: String(ledger.balance), step: '0.01', value: Number(ledger.balance).toFixed(2), 'aria-label': 'debt_amount_to_pay'.tr });
    const status = element('p', { role: 'status', class: 'muted' });
    const result = element('div');
    let operation;
    const poll = async (id) => {
      if (!historyDialog.open || !state.user || version !== accountVersion) return;
      try {
        const { charge } = await state.api('/customer/debt-pix/' + id);
        if (version !== accountVersion) return;
        if (charge.status === 'PAID') {
          status.textContent = 'payment_confirmed_by_sicredi_your_balance_has_been_updated'.tr;
          clearTimeout(debtPixTimer);
          await loadCustomerLedger();
          ledgerContent.prepend(element('p', { class: 'ledger-balance ledger-balance--clear', role: 'status', text: 'payment_confirmed_balance_updated_automatically'.tr }));
          return;
        }
      } catch { status.textContent = 'waiting_for_confirmation_you_can_reopen_my_account_to_check_your_balance'.tr; }
      debtPixTimer = setTimeout(() => poll(id), 5000);
    };
    const pay = element('button', { type: 'button', class: 'primary', text: 'pay_debt_with_pix'.tr, onclick: async () => {
      const value = Number(amount.value);
      if (!Number.isFinite(value) || value <= 0 || value > Number(ledger.balance)) { status.textContent = 'enter_an_amount_between_r_0_01_and_the_outstanding_balance'.tr; return; }
      pay.disabled = true;
      amount.disabled = true;
      if (!operation || operation.amount !== value) operation = { amount: value, requestId: crypto.randomUUID() };
      status.textContent = 'generating_sicredi_charge'.tr;
      try {
        const { charge } = await state.api('/customer/debt-pix', { method: 'POST', body: operation });
        if (version !== accountVersion) return;
        if (charge.status === 'PAID') { await poll(charge.id); return; }
        result.replaceChildren(element('img', { src: charge.pixData.qrCodeBase64, alt: 'pix_qr_code_for_debt_payment'.tr, width: '220', height: '220' }), element('textarea', { readonly: '', 'aria-label': 'pix_copy_and_paste_for_the_debt'.tr, text: charge.pixData.pixCopiaECola }), element('button', { type: 'button', class: 'quiet', text: 'copy_pix'.tr, onclick: () => navigator.clipboard.writeText(charge.pixData.pixCopiaECola).then(() => { status.textContent = 'pix_copied_waiting_for_payment'.tr; }).catch(() => { status.textContent = 'select_and_copy_the_code_above'.tr; }) }));
        status.textContent = 'pay_through_your_bank_the_charge_will_be_cleared_automatically_after_sicredi_confirms'.tr;
        poll(charge.id);
      } catch (error) {
        status.textContent = error.message;
        pay.disabled = false;
        amount.disabled = false;
      }
    } });
    section.append(element('label', { text: 'how_much_would_you_like_to_pay_r'.tr }, [amount]), pay, status, result);
  }
  const phone = String(ledger.supportPhone || state.config?.checkout?.contactPhone || '').replace(/\D/g, '');
  section.append(element('p', { class: 'muted', text: 'found_something_wrong_with_the_balance_or_a_purchase'.tr }));
  if (/^\d{10,15}$/.test(phone)) section.append(element('a', { class: 'quiet', text: 'talk_to_the_store'.tr, href: `https://wa.me/${phone.length <= 11 ? '55' + phone : phone}?text=${encodeURIComponent('hello_i_need_help_checking_my_account_and_history_at_conflora'.tr)}`, target: '_blank', rel: 'noopener noreferrer' }));
  else section.append(element('p', { class: 'muted', text: 'ask_a_store_representative_to_check_your_registration_and_transactions'.tr }));
  ledgerContent.append(section);
}

function renderCustomerLedger(ledger) {
  updateDebtBadge(ledger.balance);
  clearTimeout(debtPixTimer);
  ledgerContent.replaceChildren();
  const balance = Number(ledger.balance || 0);
  const balanceTitle = balance > 0 ? "Saldo devedor" : balance < 0 ? 'credit_in_your_favor'.tr : "Saldo quitado";
  const balanceTone = balance > 0 ? "ledger-balance--debt" : balance < 0 ? "ledger-balance--credit" : "ledger-balance--clear";
  ledgerContent.append(element("section", { class: `ledger-balance ${balanceTone}` }, [
    element("span", { class: "muted", text: `${'hello'.tr} ${ledger.customerName || state.user?.name || 'customer_a60b85'.tr}` }),
    element("strong", { text: balanceTitle }),
    element("span", { class: "ledger-balance-value", text: money(Math.abs(Math.round(balance * 100))) }),
  ]));
  const creditBalance = Number(ledger.creditBalance || 0);
  if (creditBalance > 0) ledgerContent.append(element("section", { class: 'ledger-balance ledger-balance--credit' }, [
    element("span", { class: "muted", text: 'amounts_received_in_advance'.tr }),
    element("strong", { text: creditBalance > 0 ? 'credit_in_your_favor'.tr : 'available_credit_228a53'.tr }),
    element("span", { class: "ledger-balance-value", text: money(Math.max(0, Math.round(creditBalance * 100))) }),
  ]));
  renderDebtPayment(ledger);

  const transactions = [...(ledger.transactions || [])].sort((left, right) =>
    String(right.createdAt || "").localeCompare(String(left.createdAt || "")),
  );
  ledgerContent.append(element("h3", { class: "ledger-section-title", text: 'transactions'.tr }));
  if (!transactions.length) {
    ledgerContent.append(element("p", { class: "muted", text: 'there_are_no_store_credit_purchases_or_payments_linked_to_this_profile_yet'.tr }));
    return;
  }
  for (const transaction of transactions) {
    const isDebt = transaction.type === "DEBITO_FIADO";
    const isCredit = transaction.entryType === "CREDITO_CLIENTE" || transaction.type === "CREDITO_CLIENTE";
    const isCreditUse = transaction.entryType === "USO_CREDITO" || transaction.type === "USO_CREDITO";
    const amount = Math.abs(Math.round(Number(transaction.amount || 0) * 100));
    const title = isDebt ? "Compra fiada" : isCredit ? 'credit_received'.tr : isCreditUse ? 'credit_used_in_purchase'.tr : 'store_credit_payment'.tr;
    const prefix = isDebt || isCredit ? "+ " : "− ";
    const date = transaction.createdAt ? new Date(transaction.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : 'date_not_provided'.tr;
    const meta = [date, transaction.paymentMethod, transaction.ticketNumber ? `${'sale'.tr}${transaction.ticketNumber}` : transaction.orderId ? `${'order_033893'.tr}${String(transaction.orderId).slice(-8).toUpperCase()}` : "", transaction.receivedBy ? `${'served_by'.tr} ${transaction.receivedBy}` : ""]
      .filter(Boolean).join(" · ");
    const card = element("article", { class: "ledger-transaction" }, [
      element("div", {}, [element("strong", { text: title }), element("span", { class: "muted", text: meta })]),
      element("strong", { class: isDebt ? "ledger-amount--debt" : isCreditUse ? "ledger-amount--debt" : "ledger-amount--credit", text: prefix + money(amount) }),
    ]);
    if (transaction.items?.length) {
      card.append(element("span", { class: "ledger-transaction-items", text: transaction.items.map((item) => `${item.quantity} ${item.unit || "UN"} · ${item.name}`).join(" · ") }));
    }
    if (transaction.type === "QUITACAO_FIADO") {
      card.append(element("span", { class: "muted", text: `${'outstanding_balance_after_payment'.tr} ${money(Math.round(Number(transaction.newBalance || 0) * 100))}` }));
    }
    if (transaction.receiptText) {
      card.append(element("details", { class: "ledger-receipt" }, [
        element("summary", { text: 'view_purchase_receipt'.tr }),
        window.ConfloraOrderDisplay.renderText(transaction.receiptText),
      ]));
    }
    ledgerContent.append(card);
  }
}

async function loadCustomerLedger() {
  if (!state.user) {
    notify('log_in_to_your_account_to_check_your_balance'.tr);
    return;
  }
  const version = accountVersion;
  ledgerContent.replaceChildren(element("p", { class: "muted", text: 'loading_your_balance'.tr }));
  try {
    const ledger = await state.api("/customer/ledger");
    if (version !== accountVersion) return;
    renderCustomerLedger(ledger);
  } catch (error) {
    if (version !== accountVersion) return;
    ledgerContent.replaceChildren(element("p", { class: "error", role: "alert", text: error.message }));
    if (error.status === 404) {
      ledgerContent.append(element("p", { class: "muted", text: 'to_link_your_account_inform_the_cashier_of_the_same_email_used_for_your_login_the_sta'.tr }));
    } else {
      ledgerContent.append(element("button", { type: "button", class: "quiet", text: 'try_again'.tr, onclick: loadCustomerLedger }));
    }
  }
}

// Global modal triggers and shortcuts
for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", () => button.closest("dialog")?.close());
}
for (const node of document.querySelectorAll("[data-icon]")) {
  node.replaceChildren(icon(node.dataset.icon));
}
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("click", (event) => {
    // 1. Clique fora do bottomsheet/modal (no backdrop escuro) fecha ele
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      ) {
        dialog.close();
        return;
      }
    }
    // 2. Clique nos 2 riscos do topo (handle) fecha/abaixa ele
    if (event.target.closest(".bottomsheet-handle")) {
      dialog.close();
      return;
    }
    // 3. Clique no cabeçalho do bottomsheet para abaixar/fechar (exceto botões e inputs)
    const interactive = event.target.closest("button, input, textarea, select, a, label");
    if (!interactive && dialog.classList.contains("drawer")) {
      const box = dialog.getBoundingClientRect();
      if (event.clientY >= box.top && event.clientY <= box.top + 52) {
        dialog.close();
      }
    }
  });

  // Gesto interativo de puxar o bottomsheet inteiro para baixo e abaixar/fechar
  let touchStartY = 0;
  let isDraggingSheet = false;

  dialog.addEventListener("touchstart", (e) => {
    if (window.innerWidth > 768) return;
    const touch = e.touches[0];
    if (!touch) return;
    const box = dialog.getBoundingClientRect();
    const fromHandle = Boolean(e.target.closest(".bottomsheet-handle"));
    const fromHeader = Boolean(e.target.closest(".dialog-header")) && !e.target.closest("button, input, select, textarea");
    const atTop = dialog.scrollTop <= 0 && touch.clientY <= box.top + 70;

    if (fromHandle || fromHeader || atTop) {
      touchStartY = touch.clientY;
      isDraggingSheet = true;
      dialog.style.transition = "none";
    } else {
      isDraggingSheet = false;
      touchStartY = 0;
    }
  }, { passive: true });

  dialog.addEventListener("touchmove", (e) => {
    if (!isDraggingSheet || touchStartY === 0) return;
    const touch = e.touches[0];
    if (!touch) return;
    const deltaY = touch.clientY - touchStartY;
    if (deltaY > 0 && dialog.scrollTop <= 0) {
      // Arrastando para baixo: o card inteiro desce em sincronia com o dedo, sem deixar fundo branco estático
      dialog.style.transform = `translateY(${deltaY}px)`;
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });

  dialog.addEventListener("touchend", (e) => {
    if (!isDraggingSheet) return;
    const touch = e.changedTouches[0];
    const deltaY = touch ? touch.clientY - touchStartY : 0;
    dialog.style.transition = "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)";
    if (deltaY > 70) {
      dialog.style.transform = "translateY(100%)";
      setTimeout(() => {
        dialog.close();
        dialog.style.transform = "";
        dialog.style.transition = "";
      }, 200);
    } else {
      dialog.style.transform = "translateY(0)";
      setTimeout(() => {
        dialog.style.transform = "";
        dialog.style.transition = "";
      }, 220);
    }
    isDraggingSheet = false;
    touchStartY = 0;
  }, { passive: true });
}

// Fechamento da alça no drawer da equipe
document.querySelector("#teamDrawerSheet .bottomsheet-handle")?.addEventListener("click", () => {
  const overlay = document.querySelector("#teamDrawerOverlay");
  if (overlay) overlay.classList.add("hidden");
});

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
const languageButton = $("#languageButton");
const languageMenu = $("#languageMenu");
const currentLanguageFlag = $("#currentLanguageFlag");
const currentLanguageCode = $("#currentLanguageCode");
const languageOptions = languageMenu
  ? [...languageMenu.querySelectorAll("[data-language]")]
  : [];

const renderLanguageSwitcher = () => {
  const language = getLanguage();
  if (langSelect) langSelect.value = language;
  if (currentLanguageCode) currentLanguageCode.textContent = language.toUpperCase();
  if (currentLanguageFlag) {
    currentLanguageFlag.src = `/store-assets/flags/${language}.svg`;
  }
  languageOptions.forEach((option) => {
    const selected = option.dataset.language === language;
    option.setAttribute("aria-checked", String(selected));
    option.classList.toggle("is-selected", selected);
  });
};

const closeLanguageMenu = () => {
  if (!languageMenu || !languageButton) return;
  languageMenu.hidden = true;
  languageButton.setAttribute("aria-expanded", "false");
};

if (langSelect) {
  renderLanguageSwitcher();
  langSelect.addEventListener("change", (e) => {
    setLanguage(e.target.value);
    renderLanguageSwitcher();
    closeLanguageMenu();
  });
}
languageButton?.addEventListener("click", () => {
  const isOpening = languageMenu?.hidden;
  if (!languageMenu) return;
  languageMenu.hidden = !isOpening;
  languageButton.setAttribute("aria-expanded", String(isOpening));
  if (isOpening) {
    languageMenu.querySelector('[aria-checked="true"]')?.focus();
  }
});
languageMenu?.addEventListener("click", (event) => {
  const option = event.target.closest("[data-language]");
  if (!option || !langSelect) return;
  langSelect.value = option.dataset.language;
  langSelect.dispatchEvent(new window.Event("change", { bubbles: true }));
  languageButton?.focus();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".language-switcher")) closeLanguageMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && languageMenu && !languageMenu.hidden) {
    closeLanguageMenu();
    languageButton?.focus();
  }
});

onLanguageChange(() => {
  renderLanguageSwitcher();
  applyHtmlTranslations();
  if (state.config) {
    applyConfig();
  }
});

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener("popstate", async (event) => {
  await route();
  requestAnimationFrame(() => window.scrollTo({ top: event.state?.scrollY || 0 }));
});

// Application bootstrap
let catalogRefresh;
let lastCatalogRefresh = 0;
let nextCatalogRetry = 0;
async function refreshPublicCatalog() {
  if (catalogRefresh) return catalogRefresh;
  if (navigator.onLine === false || Date.now() < nextCatalogRetry) return;
  const revision = catalogRevision;
  catalogRefresh = (async () => {
    if (catalogSource === 'cache') catalogStatus('Exibindo dados salvos. Atualizando…');
    const [config, products] = await Promise.all([
      state.api("/config"), state.api("/products"),
    ]);
    if (revision !== catalogRevision) return;
    publicCatalog?.write({ config, products });
    catalogSource = 'network';
    catalogStatus('');
    lastCatalogRefresh = Date.now();
    nextCatalogRetry = 0;
    const configChanged = JSON.stringify(state.config) !== JSON.stringify(config);
    const productsChanged = JSON.stringify(state.products) !== JSON.stringify(products);
    if (!configChanged && !productsChanged) return;
    state.config = config;
    state.products = products;
    if (configChanged) applyConfig();
    if (configChanged || productsChanged) catalog.render();
    if (productsChanged) cart.render();
    // Update a product page without replacing an open administrative form.
    if (location.pathname.includes("/products/")) await route();
  })();
  try {
    await catalogRefresh;
  } catch (error) {
    nextCatalogRetry = Date.now() + PUBLIC_FRESH_TIME;
    catalogStatus('Não foi possível atualizar. Os dados exibidos podem estar desatualizados.');
    throw error;
  } finally {
    catalogRefresh = null;
  }
}

try {
  // Apply initial HTML translations immediately
  applyHtmlTranslations();

  const session = state.api("/me").catch(() => ({ user: null }));
  const bootRevision = catalogRevision;
  const saved = await publicCatalog?.read();
  if (saved) {
    state.config = saved.config;
    state.products = saved.products;
    catalogSource = 'cache';
    lastCatalogRefresh = bootRevision === catalogRevision ? saved.savedAt : 0;
    catalogStatus('');
    performanceMonitor.count('publicCacheHit');
  } else {
    [state.config, state.products] = await Promise.all([state.api('/config'), state.api('/products')]);
    if (bootRevision === catalogRevision) {
      publicCatalog?.write(state);
      lastCatalogRefresh = Date.now();
    } else {
      catalogSource = 'cache';
      catalogStatus('Atualizando dados após uma alteração…');
    }
    performanceMonitor.count('publicCacheMiss');
  }

  catalog = createCatalog(
    state,
    (product, quantity) => cart.add(product, quantity),
    navigate,
  );
  cart = createCart(state);
  chat = createChat(state, catalog);
  orderFeedback = createOrderFeedback(state);
  let productEntry;
  state.productEntry = {
    async open(product = null) {
      try {
        productEntry ||= import("./product-entry.js").then(({ createProductEntry }) => createProductEntry(state, state.reloadProducts));
        await (await productEntry).open(product);
      } catch (error) { productEntry = null; notify(error.message); }
    },
  };
  $('#openProductEntry')?.addEventListener('click', () => state.productEntry.open());

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

  performanceMonitor.markCatalogReady();
  if ((saved && !saved.fresh) || bootRevision !== catalogRevision) refreshPublicCatalog().catch(() => {});
  // Login resolution does not block the public catalogue or its first render.
  session.then(async ({ user }) => {
    state.user = user || null;
    appStore.getState().setUser(state.user);
    updateHeaderActions();
    if (topbarIntent.has('bag'.tr)) cart.open();
      if (topbarIntent.has('conta')) account().then(() => { if (topbarIntent.has('editar')) editOwnProfile(); }).catch(error => notify(error.message));
    catalog.refreshPurchases();
    const notificationOrder = new URLSearchParams(location.search).get("order");
    if (notificationOrder && state.user) openPurchaseHistory(notificationOrder);
    if (/\/(admin|configuracoes)\/?$/.test(location.pathname)) await route();
  }).catch(() => {});
  let lastCatalogInteraction = Date.now();
  const refreshOnReturn = () => {
    if (document.visibilityState === "visible") {
      lastCatalogInteraction = Date.now();
      orderFeedback?.checkPendingDeliveredOrder();
      if (Date.now() - lastCatalogRefresh >= PUBLIC_FRESH_TIME) {
        refreshPublicCatalog().catch(() => {});
      }
    }
  };
  document.addEventListener("visibilitychange", refreshOnReturn);
  window.addEventListener("online", () => { lastCatalogRefresh = 0; nextCatalogRetry = 0; refreshOnReturn(); });
  window.addEventListener('offline', () => catalogStatus('Sem conexão. Consulta disponível; operações precisam de confirmação do servidor.'));
  const catalogInteraction = () => {
    lastCatalogInteraction = Date.now();
    if (Date.now() - lastCatalogRefresh >= PUBLIC_FRESH_TIME) refreshPublicCatalog().catch(() => {});
  };
  window.addEventListener('pointerdown', catalogInteraction, { passive: true });
  window.addEventListener('keydown', catalogInteraction);
  // Only one short-lived public refresh while visible; no private background polling.
  let catalogTimer;
  const scheduleCatalogRefresh = () => {
    clearTimeout(catalogTimer);
    catalogTimer = setTimeout(async () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCatalogInteraction < 120000) {
        try { await refreshPublicCatalog(); } catch { /* Failure must not advance freshness. */ }
      }
      scheduleCatalogRefresh();
    }, document.visibilityState === 'visible' && navigator.onLine !== false && Date.now() - lastCatalogInteraction < 120000 ? Math.max(1000, nextCatalogRetry - Date.now(), PUBLIC_FRESH_TIME - (Date.now() - lastCatalogRefresh)) : PUBLIC_FRESH_TIME);
  };
  scheduleCatalogRefresh();
  window.addEventListener('pagehide', () => clearTimeout(catalogTimer));
  window.addEventListener('pageshow', () => { refreshOnReturn(); scheduleCatalogRefresh(); });
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("/storefront/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }
} catch (error) {
  $('#products').removeAttribute('aria-busy');
  $("#storeName").textContent = 'conflora_store'.tr;
  $("#logo").src = shellLogoUrl;
  $("#logo").alt = 'conflora_garden_nursery'.tr;
  $("#logo").hidden = false;
  $("#brand").classList.add("has-logo");
  const isNetwork = error.message?.includes("fetch") || error.name === "TypeError";
  const errorMessage = isNetwork
    ? 'connecting_to_catalog_if_it_doesn_t_load_shortly_click_to_try_again'.tr
    : error.message;
  $("#products").replaceChildren(
    element("p", { text: errorMessage, class: "error" }),
    element("button", {
      text: 'common_retry'.tr,
      onclick: () => location.reload(),
    }),
  );
  // Do not loop full-page reloads on a slow link; keep the explicit retry action.
}
