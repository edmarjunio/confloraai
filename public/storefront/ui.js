export const $ = (selector) => document.querySelector(selector);
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
export function openDialog(dialog) {
  if (!dialog.open) {
    dialog.showModal();
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
    notify("Chave PIX copiada.");
  } catch {
    notify("Não foi possível copiar. Selecione a chave exibida.");
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
      const response = await fetch(
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
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Não foi possível concluir.");
      }
      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("A solicitação demorou. Tente novamente.");
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
