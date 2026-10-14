export class ApiError extends Error {
  constructor(status, data) { super(data?.code || 'error.generic'); this.status = status; this.code = data?.code; }
}
export function errorKey(error) {
  if (error instanceof ApiError) return ({ 400: 'error.invalid', 401: 'error.auth', 403: 'error.forbidden', 404: 'error.notFound', 409: 'error.conflict', 422: 'error.invalid', 429: 'error.unavailable', 503: 'error.unavailable' })[error.status] || 'error.generic';
  return 'error.network';
}
export async function request(url, { body, headers, signal, ...options } = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options,
    headers: { ...(body && !(body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body instanceof Blob ? body : body ? JSON.stringify(body) : undefined,
    signal: signal || AbortSignal.timeout(25000),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok || data?.success === false) throw new ApiError(response.status, data);
  return data;
}
