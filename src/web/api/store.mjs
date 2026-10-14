import { request } from './http.mjs';
const match = globalThis.location?.pathname.match(/^\/shop\/([^/]+)/);
export const tenant = match ? decodeURIComponent(match[1]) : '';
export const basePath = tenant ? `/shop/${encodeURIComponent(tenant)}` : '';
export const storePath = path => tenant ? `/api/stores/${encodeURIComponent(tenant)}${path}` : `/api/storefront${path}`;
export const accountPath = path => tenant ? storePath(path) : `/api${path}`;
export async function loadCatalog(signal) {
  if (!tenant) return request('/api/storefront/catalog', { signal });
  const [config, products] = await Promise.all([request(storePath('/config'), { signal }), request(storePath('/products'), { signal })]);
  return { config, products };
}
export async function loadOrders(admin = false, signal) {
  const url = tenant ? storePath(admin ? '/admin/orders' : '/orders') : admin ? '/api/admin/orders' : '/api/customer/orders';
  const result = await request(url, { signal });
  return Array.isArray(result) ? result : result.orders || [];
}
export const orderMinor = order => order.totalMinor ?? Math.round(Number(order.total || 0) * 100);
