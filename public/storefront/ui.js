export const $ = (selector) => document.querySelector(selector);
export async function readJsonResponse(response) {
  const message =
    'the_service_is_temporarily_unavailable_please_try_again_shortly'.tr;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(message);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(message);
  }
}
export function element(tag, properties = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(properties)) {
    if (key === "text") {
      node.textContent = value;
    } else if (key.startsWith("on")) {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "class") {
      node.className = value;
    } else {
      node.setAttribute(key, value);
    }
  }
  node.append(...children);
  return node;
}
export const money = (amount) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    amount / 100,
  );
export const normalize = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function notify(message) {
  const host = document.querySelector("dialog:modal") || document.body;
  host.append($("#toast"));
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 4000);
}
export function lockBodyScroll() {
  if (typeof document === "undefined" || document.body.dataset.scrollLocked) return;
  const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.dataset.scrollLocked = String(scrollY);
  document.documentElement.style.overflow = "hidden";
  document.documentElement.style.height = "100%";
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.body.style.touchAction = "none";
}

export function unlockBodyScroll() {
  if (typeof document === "undefined" || !document.body.dataset.scrollLocked) return;
  const scrollY = Number(document.body.dataset.scrollLocked || 0);
  delete document.body.dataset.scrollLocked;
  document.documentElement.style.overflow = "";
  document.documentElement.style.height = "";
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.touchAction = "";
  window.scrollTo(0, scrollY);
}

export function openDialog(dialog) {
  if (!dialog) return;
  lockBodyScroll();
  dialog.addEventListener("close", () => {
    unlockBodyScroll();
  }, { once: true });
  if (!dialog.open) {
    try {
      dialog.showModal();
    } catch {
      dialog.show();
    }
  }
}
export function storageGet(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage can be disabled; shopping remains available. */
  }
}
export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    notify('pix_key_copied_3ab8fd'.tr);
  } catch {
    notify('could_not_copy_select_the_displayed_key'.tr);
  }
}
export function createApi(slug) {
  return async (route, { method = "GET", body, headers = {} } = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      route === "/assistant" ? 45000 : 15000,
    );
    try {
      const response = await window.ConfloraSession.apiFetch(
        `/api/stores/${encodeURIComponent(slug)}${route}`,
        {
          method,
          credentials: "same-origin",
          signal: controller.signal,
          headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...headers,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      const data = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'could_not_complete'.tr);
      }
      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error('the_request_took_too_long_please_try_again'.tr);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
}
export function inputField(label, name, value = "", type = "text") {
  return element("label", { text: label }, [
    element("input", { name, value, type }),
  ]);
}
export function quantityControl(input) {
  const change = (direction) => {
    const value = Number(input.value) + direction * Number(input.step || 1);
    if (
      value < Number(input.min || 1) ||
      (input.max && value > Number(input.max))
    ) {
      return;
    }
    input.value = Number(value.toFixed(6));
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  };
  return element("div", { class: "quantity-control" }, [
    element("button", {
      type: "button",
      text: "−",
      "aria-label": "Diminuir quantidade",
      onclick: () => change(-1),
    }),
    input,
    element("button", {
      type: "button",
      text: "+",
      "aria-label": "Aumentar quantidade",
      onclick: () => change(1),
    }),
  ]);
}
