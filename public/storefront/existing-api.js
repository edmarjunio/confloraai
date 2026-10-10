// The main store keeps its current accounts, catalogue and order processing.
// Tenant storefronts continue to use /api/stores/:slug without this adapter.
export function createExistingApi() {
  let catalogPromise;
  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    if (path === "/api/auth/me" && response.status === 401) {
      return { user: null };
    }
    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(
        data.error || data.message || "Não foi possível concluir.",
      );
    }
    return data;
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
    if (route === "/config" || route === "/products") {
      catalogPromise ||= request("/api/storefront/catalog");
      const result = await catalogPromise;
      return route === "/config" ? result.config : result.products;
    }
    if (route === "/me") {
      return request("/api/auth/me");
    }
    if (route.startsWith("/auth/")) {
      return request("/api" + route, options);
    }
    if (route === "/assistant") {
      return request("/api/storefront/assistant", options);
    }
    if (route === "/orders" && options.method === "POST") {
      const result = await request("/api/storefront/orders", options);
      catalogPromise = null;
      return order(result.order);
    }
    if (route === "/orders") {
      const result = await request("/api/customer/orders");
      return (result.orders || []).map(order);
    }
    throw new Error("Use o painel administrativo da loja para esta operação.");
  };
}
