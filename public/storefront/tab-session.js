/* Each tab owns its session. Credentials never enter URLs or shared storage. */
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
  if (typeof String !== 'undefined' && typeof String.prototype.tr === 'undefined') {
    Object.defineProperty(String.prototype, 'tr', {
      get() {
        try {
          return (typeof window.tr === 'function' ? window.tr(this.valueOf()) : this.valueOf()) || this.valueOf();
        } catch {
          return this.valueOf();
        }
      },
      configurable: true,
      enumerable: false,
    });
  }
  if (window.ConfloraSession) return;
  const nativeFetch = window.fetch.bind(window);
  const tenant = /^\/shop\/([^/]+)/.exec(location.pathname)?.[1];
  const read = (key) => { try { return window.sessionStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { if (value) window.sessionStorage.setItem(key, value); else window.sessionStorage.removeItem(key); } catch { /* Keep the current tab usable in memory. */ } };
  let storageAvailable = true;
  try { window.sessionStorage.setItem('conflora_storage_probe', '1'); window.sessionStorage.removeItem('conflora_storage_probe'); } catch { storageAvailable = false; }
  const tokenKey = 'conflora_tab_token_v1';
  const initializedKey = 'conflora_tab_initialized_v1';
  let token = read(tokenKey) || '';
  let initialized = !storageAvailable || read(initializedKey) === '1';
  let generation = 0;
  const tabId = read('conflora_tab_id_v1') || crypto.randomUUID();
  write('conflora_tab_id_v1', tabId);
  // Tenant authentication retains its separate, scoped contract.
  if (tenant) { window.ConfloraSession = { tabId, apiFetch: nativeFetch }; return; }
  const apiFetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return nativeFetch(input, options);
    const headers = new window.Headers(input instanceof window.Request ? input.headers : undefined);
    new window.Headers(options.headers).forEach((value, name) => headers.set(name, value));
    headers.set('X-Conflora-Tab-Session', initialized || token ? '1' : 'bootstrap');
    if (token) headers.set('Authorization', 'Bearer ' + token);
    const version = generation;
    const response = await nativeFetch(input, { ...options, headers });
    const isLogin = /\/auth\/(?:login|register|google)$/.test(url.pathname);
    if (isLogin && response.ok) generation += 1;
    if (response.headers.has('X-Conflora-Session') && (isLogin || version === generation)) {
      token = response.headers.get('X-Conflora-Session') || '';
      write(tokenKey, token);
    }
    if (url.pathname === '/api/auth/me' || (isLogin && response.ok) || url.pathname === '/api/auth/logout') {
      initialized = true; write(initializedKey, '1');
      if (url.pathname === '/api/auth/logout' && response.ok) { generation += 1; token = ''; write(tokenKey, ''); }
    }
    return response;
  };

  // Native EventSource cannot attach the tab credential; use a fetch stream.
  function openEventStream(url) {
    const events = new window.EventTarget();
    let controller; let timer; let closed = false;
    const connect = async () => {
      if (closed) return;
      controller = new AbortController();
      try {
        const response = await apiFetch(url, { signal: controller.signal, headers: { Accept: 'text/event-stream' } });
        if (!response.ok) throw new Error('could_not_track_updates'.tr);
        const reader = response.body.getReader(); const decoder = new window.TextDecoder(); let buffer = '';
        while (!closed) {
          const { value, done } = await reader.read(); if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
          let boundary;
          while ((boundary = buffer.indexOf('\n\n')) >= 0) {
            const chunk = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
            let name = 'message'; const data = [];
            for (const line of chunk.split('\n')) {
              if (line.startsWith('event:')) name = line.slice(6).trim();
              if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
            }
            if (data.length) events.dispatchEvent(new window.MessageEvent(name, { data: data.join('\n') }));
          }
        }
      } catch { if (!closed) events.dispatchEvent(new window.Event('error')); }
      if (!closed) timer = setTimeout(connect, 3000);
    };
    events.close = () => { closed = true; clearTimeout(timer); controller?.abort(); };
    connect(); return events;
  }
  function watchOrderUpdates(onChange) {
    const stream = openEventStream('/api/caixa/orders/stream');
    let fallbackTimer; let refreshTimer;
    const refresh = () => {
      if (document.visibilityState === 'hidden' || refreshTimer) return;
      refreshTimer = setTimeout(() => { refreshTimer = null; onChange(); }, 100);
    };
    const connected = () => { window.clearInterval(fallbackTimer); fallbackTimer = null; refresh(); };
    const fallback = () => { if (!fallbackTimer) fallbackTimer = window.setInterval(refresh, 30000); };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    stream.addEventListener('orders-changed', connected);
    stream.addEventListener('stream-fallback', fallback);
    stream.addEventListener('error', fallback);
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearInterval(fallbackTimer); clearTimeout(refreshTimer); stream.close(); document.removeEventListener('visibilitychange', visible); };
  }
  async function openPrivateFile(url) {
    const preview = window.open('about:blank', '_blank');
    if (preview) preview.opener = null;
    try {
      const response = await apiFetch(url);
      if (!response.ok) throw new Error('could_not_open_receipt'.tr);
      const objectUrl = URL.createObjectURL(await response.blob());
      if (preview) preview.location.href = objectUrl;
      else { URL.revokeObjectURL(objectUrl); throw new Error('allow_opening_a_new_window_to_view_the_receipt'.tr); }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) { preview?.close(); throw error; }
  }
  window.ConfloraSession = { tabId, apiFetch, openEventStream, watchOrderUpdates, openPrivateFile };
})();
