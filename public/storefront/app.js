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

const cashierShortcut = $("#cashierShortcut");
function updateHeaderActions() {
  const role = String(state.user?.role || "CLIENTE").toUpperCase();
  const isLoggedIn = Boolean(state.user);
  const allowedCashierRoles = ["ADMIN", "CAIXA", "VENDEDOR"];
  const identity = $("#headerAccountIdentity");

  identity.hidden = !isLoggedIn;
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
  const logoUrl = config.branding?.logoUrl || "/store-assets/brands/conflora-logo.png";
  const logo = $("#logo");
  const defaultLogoUrl = "/store-assets/brands/conflora-logo.png";
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
  logo.alt = config.identity?.name || "";
  $("#storeIcon").href = config.branding?.iconUrl || "data:,";
  $("#brand").href = basePath || "/";
  $("#brand").classList.add("has-logo");

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
    content.append(element("p", { text: `Olá, ${state.user.name}` }));
    if (
      state.user.role === "ADMIN" ||
      (existingStore && state.user.role === "CAIXA")
    ) {
      content.append(
        element("button", {
          class: "primary",
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
    content.append(element("h3", { text: "cart.title".tr }));
    try {
      const orders = await state.api("/orders");
      for (const order of orders.sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      )) {
        content.append(
          element("article", { class: "order-card" }, [
            element("strong", {
              text: `#${order.id.slice(0, 8)} · ${money(order.totalMinor)}`,
            }),
            element("span", {
              class: "badge",
              text: order.status,
            }),
            ...order.items.map((i) =>
              element("p", { text: `${i.quantity} × ${i.name}` }),
            ),
          ]),
        );
      }
      if (!orders.length) {
        content.append(
          element("p", {
            text: "cart.empty_subtitle".tr,
          }),
        );
      }
    } catch (error) {
      content.append(element("p", { text: error.message }));
    }
  } else {
    const form = element("form");
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
    });
    const button = element("button", {
      type: "submit",
      class: "primary",
      text: "cart.submit_order".tr,
    });
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
  await route();
  if (existingStore) {
    import("/storefront-auth.js").catch(() => {});
  }
} catch (error) {
  $("#storeName").textContent = "Loja Conflora";
  $("#products").replaceChildren(
    element("p", { text: error.message, class: "error" }),
    element("button", {
      text: "common.retry".tr,
      onclick: () => location.reload(),
    }),
  );
}
