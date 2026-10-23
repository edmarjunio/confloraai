/* Passive capture only: no timer, polling, performance tracking, or request bodies. */
(() => {
  try {
    for (const target of [window, Object.getPrototypeOf(window), window.Window?.prototype]) {
      if (!target) continue;
      const desc = Object.getOwnPropertyDescriptor(target, 'fetch');
      if (desc && desc.get && !desc.set && desc.configurable !== false) {
        let current = desc.get.call(window);
        Object.defineProperty(target, 'fetch', {
          configurable: true,
          enumerable: desc.enumerable !== false,
          get() { return current; },
          set(fn) { if (typeof fn === 'function') current = fn; },
        });
      }
    }
  } catch { /* Keep native fetch descriptor when not configurable. */ }
  if (window.ConfloraErrorMonitor) return;
  const isExtensionError = (message, file, stack) =>
    /(?:chrome|moz|safari|edge)-extension:\/\//i.test(`${file || ''}\n${stack || ''}`) ||
    /Cannot set property fetch of #<Window> which has only a getter/i.test(String(message || ''));
  const sent = new Set();
  let count = 0;
  const report = (message, error, file, line) => {
    const stack = String(error?.stack || '');
    if (!message || message === 'Script error.' || count >= 5 || isExtensionError(message, file, stack)) return;
    const key = String(message).slice(0, 200);
    if (sent.has(key)) return;
    sent.add(key); count++;
    const payload = { message: String(message).slice(0, 1000), stack: stack.slice(0, 4000), file: String(file || '').split(/[?#]/)[0], line: Number(line) || 0, page: location.pathname };
    const apiFetch = window.ConfloraSession?.apiFetch || window.fetch.bind(window);
    apiFetch('/api/client-errors', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
  };
  window.addEventListener('error', event => {
    if (isExtensionError(event.message, event.filename, event.error?.stack)) {
      event.stopImmediatePropagation();
      event.preventDefault();
      return;
    }
    if (event.message) report(event.message, event.error, event.filename, event.lineno);
  }, true);
  window.addEventListener('unhandledrejection', event => {
    const message = event.reason?.message || String(event.reason || 'unexpected_browser_failure'.tr);
    if (isExtensionError(message, '', event.reason?.stack)) {
      event.stopImmediatePropagation();
      event.preventDefault();
      return;
    }
    report(message, event.reason);
  }, true);
  window.ConfloraErrorMonitor = { active: true };
})();
