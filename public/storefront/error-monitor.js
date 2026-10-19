/* Passive capture only: no timer, polling, performance tracking, or request bodies. */
(() => {
  if (window.ConfloraErrorMonitor) return;
  const sent = new Set();
  let count = 0;
  const report = (message, error, file, line) => {
    if (!message || message === 'Script error.' || count >= 5) return;
    const key = String(message).slice(0, 200);
    if (sent.has(key)) return;
    sent.add(key); count++;
    const payload = { message: String(message).slice(0, 1000), stack: String(error?.stack || '').slice(0, 4000), file: String(file || '').split(/[?#]/)[0], line: Number(line) || 0, page: location.pathname };
    const apiFetch = window.ConfloraSession?.apiFetch || window.fetch.bind(window);
    apiFetch('/api/client-errors', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
  };
  window.addEventListener('error', event => { if (event.message) report(event.message, event.error, event.filename, event.lineno); });
  window.addEventListener('unhandledrejection', event => report(event.reason?.message || String(event.reason || 'Falha inesperada no navegador'), event.reason));
  window.ConfloraErrorMonitor = { active: true };
})();
