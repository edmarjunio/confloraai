import {
  $,
  element,
  createApi,
  openDialog,
  notify,
  storageGet,
  storageSet,
  money,
} from "./ui.js";
import { createCatalog } from "./catalog.js";
import { createCart } from "./cart.js";
import { createChat } from "./chat.js";
import { createAdmin } from "./admin.js";

const slug = decodeURIComponent(location.pathname.split("/")[2]);
const state = {
  slug,
  api: createApi(slug),
  config: null,
  products: [],
  user: null,
};
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
async function route() {
  if (!state.config) {
    return;
  }
  const path = location.pathname.split("/");
  const isAdmin = path[3] === "admin";
  const isProduct = path[3] === "products";
  $("#catalogView").hidden = isAdmin || isProduct;
  $("#productView").hidden = !isProduct;
  $("#adminView").hidden = !isAdmin;
  document.title = state.config.identity.name;
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
  const tokens = {
    primary: "--primary-color",
    accent: "--accent-color",
    text: "--text-color",
    background: "--bg-color",
  };
  for (const [name, token] of Object.entries(tokens)) {
    document.documentElement.style.setProperty(
      token,
      config.branding.colors[name],
    );
  }
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
  $("#storeName").textContent = config.identity.name;
  $("#subtitle").textContent = config.identity.subtitle;
  $("#region").textContent = [config.identity.city, config.identity.region]
    .filter(Boolean)
    .join(" · ");
  $("#logo").hidden = !config.branding.logoUrl;
  $("#logo").src = config.branding.logoUrl || "/store-assets/placeholder.svg";
  $("#logo").alt = config.identity.name;
  $("#storeIcon").href = config.branding.iconUrl || "data:,";
  $("#brand").href = `/shop/${slug}`;
  document.querySelector("meta[name=theme-color]").content =
    config.branding.colors.primary;
  catalog?.categories();
  cart?.configure();
  chat?.configure();
}
state.applyConfig = applyConfig;
state.refreshCatalog = () => catalog.render();
state.reloadProducts = async () => {
  state.products = await state.api("/products");
  catalog.render();
  cart.render();
};

async function account() {
  const content = $("#accountContent");
  content.replaceChildren();
  if (state.user) {
    content.append(element("p", { text: `Olá, ${state.user.name}` }));
    if (state.user.role === "ADMIN") {
      content.append(
        element("button", {
          class: "primary",
          text: "Gerenciar catálogo, pedidos e configurações",
          onclick: () => navigate(`/shop/${slug}/admin`),
        }),
      );
    }
    content.append(
      element("button", {
        text: "Sair",
        onclick: async () => {
          try {
            await state.api("/auth/logout", { method: "POST" });
            state.user = null;
            $("#accountButton").textContent = "Entrar";
            $("#accountDialog").close();
            navigate(`/shop/${slug}`);
          } catch (error) {
            notify(error.message);
          }
        },
      }),
    );
    content.append(element("h3", { text: "Seus pedidos" }));
    try {
      const orders = await state.api("/orders");
      const labels = {
        PENDING: "Pendente",
        CONFIRMED: "Em separação",
        DELIVERED: "Entregue",
        CANCELLED: "Cancelado",
      };
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
              text: labels[order.status] || order.status,
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
            text: "Seus pedidos feitos com a conta conectada aparecerão aqui.",
          }),
        );
      }
    } catch (error) {
      content.append(element("p", { text: error.message }));
    }
  } else {
    const form = element("form");
    const mode = element("select", { "aria-label": "Acesso à conta" }, [
      element("option", { value: "login", text: "Entrar" }),
      element("option", { value: "register", text: "Criar conta" }),
    ]);
    const name = element("input", {
      name: "name",
      placeholder: "Seu nome",
      autocomplete: "name",
      maxlength: "100",
    });
    const nameLabel = element("label", { text: "Nome" }, [name]);
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
      minlength: "10",
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
      text: "Continuar",
    });
    const errorLabel = element("p", { class: "error", role: "alert" });
    form.append(
      mode,
      nameLabel,
      element("label", { text: "E-mail" }, [email]),
      element("label", { text: "Senha (mínimo 10 caracteres)" }, [password]),
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
        $("#accountButton").textContent = state.user.name;
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
function onboarding() {
  const key = `store:${slug}:onboarding:v1`;
  const seen = storageGet(key, {});
  const hints = {
    catalog:
      "Compra rápida: use Adicionar no produto para colocá-lo na sacola.",
    ai: "Precisa de ajuda? Toque no botão do assistente para conversar e receber sugestões.",
    checkout: "Finalize nesta tela. Se escolher PIX, use Copiar chave PIX.",
  };
  let current;
  let highlighted;
  const clearHighlight = () => highlighted?.classList.remove("coach-target");
  state.coachFor = (target) => {
    if (seen[target]) {
      return;
    }
    current = target;
    clearHighlight();
    highlighted = $(
      target === "catalog"
        ? "#products .primary"
        : target === "ai"
          ? "#aiFab"
          : "#paymentOptions",
    );
    highlighted?.classList.add("coach-target");
    $("#coachText").textContent = hints[target];
    // Keep coach marks inside an open modal so they remain reachable by keyboard.
    const host = target === "checkout" ? $("#cartDialog") : document.body;
    host.append($("#coach"));
    $("#coach").hidden = false;
    if (highlighted && target !== "checkout") {
      const box = highlighted.getBoundingClientRect();
      const coach = $("#coach");
      coach.style.right = "auto";
      coach.style.left =
        Math.max(12, Math.min(box.left, window.innerWidth - 292)) + "px";
      coach.style.bottom = "auto";
      coach.style.top =
        Math.max(
          12,
          Math.min(
            box.bottom + 12,
            window.innerHeight - coach.offsetHeight - 90,
          ),
        ) + "px";
    }
  };
  $("#coachNext").addEventListener("click", () => {
    seen[current] = true;
    storageSet(key, seen);
    $("#coach").hidden = true;
    clearHighlight();
    if (current === "catalog" && state.config.assistant.enabled) {
      state.coachFor("ai");
    }
  });
  $("#coachSkip").addEventListener("click", () => {
    storageSet(key, { catalog: true, ai: true, checkout: true });
    Object.assign(seen, { catalog: true, ai: true, checkout: true });
    $("#coach").hidden = true;
    clearHighlight();
  });
  if (!location.pathname.endsWith("/admin")) {
    state.coachFor("catalog");
  }
}
for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", () => button.closest("dialog").close());
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
$("#brand").addEventListener("click", (event) => {
  event.preventDefault();
  navigate(`/shop/${slug}`);
});
$("#accountButton").addEventListener("click", () =>
  account().catch((error) => notify(error.message)),
);
window.addEventListener("popstate", route);
try {
  [state.config, state.products] = await Promise.all([
    state.api("/config"),
    state.api("/products"),
  ]);
  state.user = (await state.api("/me")).user;
  if (state.user) {
    $("#accountButton").textContent = state.user.name;
  }
  catalog = createCatalog(
    state,
    (product, quantity) => cart.add(product, quantity),
    navigate,
  );
  cart = createCart(state);
  chat = createChat(state, catalog);
  admin = createAdmin(state);
  applyConfig();
  catalog.render();
  cart.render();
  await route();
  onboarding();
} catch (error) {
  $("#storeName").textContent = "Loja indisponível";
  $("#products").replaceChildren(
    element("p", { text: error.message, class: "error" }),
    element("button", {
      text: "Tentar novamente",
      onclick: () => location.reload(),
    }),
  );
}
