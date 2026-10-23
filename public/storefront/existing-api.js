// The main store keeps its current accounts, catalogue and order processing.
// Tenant storefronts continue to use /api/stores/:slug without this adapter.
import { readJsonResponse } from "./ui.js";
export function createExistingApi() {
  let catalogPromise;
  async function request(path, options = {}) {
    const isGet = !options.method || options.method === "GET";
    const maxRetries = isGet ? 3 : 0;
    let attempt = 0;
    while (true) {
      try {
        const response = await window.ConfloraSession.apiFetch(path, {
          credentials: "same-origin",
          signal: AbortSignal.timeout(15000),
          ...options,
          headers: { "Content-Type": "application/json", ...options.headers },
          ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        });
        if (path === "/api/auth/me" && response.status === 401) {
          return { user: null };
        }
        const data = await readJsonResponse(response);
        if (!response.ok || data.success === false) {
          const error = new Error(data.error || data.message || 'could_not_complete'.tr);
          error.status = response.status;
          error.code = data.code || "";
          throw error;
        }
        return data;
      } catch (err) {
        attempt++;
        const isTransient =
          err.name === "TypeError" ||
          err.name === "TimeoutError" ||
          err.message?.includes("Failed to fetch") ||
          err.message?.includes("NetworkError") ||
          err.message?.includes("abort");
        if (attempt <= maxRetries && isTransient) {
          await new Promise((res) => setTimeout(res, attempt * 400));
          continue;
        }
        throw err;
      }
    }
  }
  function order(record) {
    return {
      ...record,
      id: String(record.id),
      createdAt: record.createdAt || "",
      totalMinor: Math.round(Number(record.total || 0) * 100),
      items: (record.items || []).map((item) => ({
        ...item,
        subtotalMinor: Math.round(
          Number(item.price || 0) * item.quantity * 100,
        ),
      })),
    };
  }
  return async (route, options = {}) => {
    if (route === "/admin/config") {
      const result = await request("/api/storefront/admin/config", options);
      catalogPromise = null;
      return result;
    }
    if ((route === "/config" || route === "/products") && (!options.method || options.method === "GET")) {
      catalogPromise ||= request("/api/storefront/catalog");
      const pending = catalogPromise;
      try {
        const result = await pending;
        return route === "/config" ? result.config : result.products;
      } finally {
        if (catalogPromise === pending) catalogPromise = null;
      }
    }
    if (route === "/me") {
      return request("/api/auth/me");
    }
    if (route === "/favorites") {
      return request("/api/customer/favorites", options);
    }
    if (route === "/customer/ledger") {
      return request("/api/customer/ledger", options);
    }
    if (route.startsWith('/customer/debt-pix')) {
      return request('/api' + route, options);
    }
    if (route.startsWith("/customer/orders")) {
      const query = route.slice("/customer/orders".length);
      return request(`/api/customer/orders${query}`, options);
    }
    if (route.startsWith("/auth/")) {
      return request("/api" + route, options);
    }
    if (route === "/assistant") {
      const { reply } = await request("/api/chat", options);
      return { message: reply };
    }
    if (route === "/site-feedback" || route === "/feedback") {
      return request("/api" + route, options);
    }
    if (route === "/inventory-settings") {
      if (options.method === "PUT") {
        catalogPromise = null;
        return request("/api/storefront/inventory-settings", options);
      }
      return request("/api/storefront/inventory-settings", options);
    }
    if (route === "/products" && options.method === "POST") {
      catalogPromise = null;
      const res = await request("/api/storefront/products", options);
      return res.product;
    }
    if (route === "/stock/quick-entry" && options.method === "POST") {
      catalogPromise = null;
      const res = await request("/api/storefront/stock/quick-entry", options);
      return res.product;
    }
    if (route.startsWith("/products/") && route.endsWith("/status") && options.method === "PUT") {
      catalogPromise = null;
      const res = await request("/api/storefront" + route, options);
      return res.product;
    }
    if (route === "/admin/products" || route === "/admin/products/") {
      catalogPromise ||= request("/api/storefront/catalog");
      const result = await catalogPromise;
      return result.products;
    }
    if (route === "/orders" && options.method === "POST") {
      const result = await request("/api/storefront/orders", options);
      catalogPromise = null;
      return {
        ...order(result.order),
        receiptDelivery: result.receiptDelivery,
      };
    }
    if (route === "/orders") {
      const result = await request("/api/customer/orders");
      return (result.orders || []).map(order);
    }
    throw new Error('use_the_store_s_admin_panel_for_this_operation'.tr);
  };
}
