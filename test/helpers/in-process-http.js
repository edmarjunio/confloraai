const http = require('node:http');
const { Duplex } = require('node:stream');

// Exercise Express, its middleware and serialization without opening a network socket.
function dispatch(app, input, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(input, 'http://127.0.0.1');
    const socket = new Duplex({ read() {}, write(_chunk, _encoding, done) { done(); } });
    socket.remoteAddress = '127.0.0.1';
    const req = new http.IncomingMessage(socket);
    Object.assign(req, { url: url.pathname + url.search, method: options.method || 'GET', httpVersion: '1.1', httpVersionMajor: 1, httpVersionMinor: 1, complete: true });
    req.headers = Object.fromEntries(new Headers(options.headers).entries());
    req.headers.host ||= url.host;
    if (options.body) req.headers['content-length'] = String(Buffer.byteLength(options.body));
    req.push(options.body ? Buffer.from(options.body) : null);
    if (options.body) req.push(null);
    const res = new http.ServerResponse(req);
    socket.on('drain', () => res.emit('drain'));
    res.assignSocket(socket);
    let controller, resolved = false, closed = false;
    const body = new ReadableStream({
      start(value) { controller = value; },
      cancel() { closed = true; req.destroy(); res.destroy(); socket.destroy(); },
    });
    const send = data => { if (data && !closed) controller.enqueue(Buffer.isBuffer(data) ? data : Buffer.from(data)); };
    const write = res.write;
    const end = res.end;
    const flush = res.flushHeaders;
    res.write = function (data, ...args) { send(data); return write.call(this, data, ...args); };
    res.end = function (data, ...args) { if (typeof data !== 'function') send(data); return end.call(this, data, ...args); };
    const respond = () => {
      if (resolved) return;
      resolved = true;
      const headers = new Headers();
      for (const [name, value] of Object.entries(res.getHeaders())) {
        if (Array.isArray(value)) value.forEach(item => headers.append(name, String(item)));
        else headers.set(name, String(value));
      }
      const response = new Response([204, 205, 304].includes(res.statusCode) ? null : body, { status: res.statusCode, headers });
      Object.defineProperty(response, 'url', { value: url.href });
      resolve(response);
    };
    res.flushHeaders = function () { flush.call(this); respond(); };
    res.on('error', reject);
    res.on('finish', () => {
      if (!closed) { closed = true; controller.close(); }
      respond(); socket.destroy();
    });
    options.signal?.addEventListener('abort', () => { req.destroy(); res.destroy(); socket.destroy(); if (!closed) { closed = true; controller.error(options.signal.reason); } }, { once: true });
    app(req, res);
  });
}

// Opt-in preload for the existing test suite. Each process has its own server map.
function installInProcessHttp() {
  const servers = new Map();
  let port = 18000;
  const originalListen = http.Server.prototype.listen;
  const originalClose = http.Server.prototype.close;
  const originalAddress = http.Server.prototype.address;
  const networkFetch = globalThis.fetch;
  http.Server.prototype.listen = function (...args) {
    if (typeof args[0] !== 'number') return originalListen.apply(this, args);
    this.inProcessPort = args[0] || ++port;
    servers.set(this.inProcessPort, this);
    const callback = args.find(arg => typeof arg === 'function');
    if (callback) this.once('listening', callback);
    queueMicrotask(() => this.emit('listening'));
    return this;
  };
  http.Server.prototype.address = function () {
    return this.inProcessPort ? { port: this.inProcessPort, family: 'IPv4', address: '127.0.0.1' } : originalAddress.call(this);
  };
  http.Server.prototype.close = function (callback) {
    if (!this.inProcessPort) return originalClose.call(this, callback);
    servers.delete(this.inProcessPort);
    queueMicrotask(() => { this.emit('close'); callback?.(); });
    return this;
  };
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const server = servers.get(Number(url.port));
    if (!server || !['localhost', '127.0.0.1'].includes(url.hostname)) return networkFetch(input, options);
    const app = (req, res) => server.emit('request', req, res);
    let response = await dispatch(app, url, options);
    if ([301, 302, 303, 307, 308].includes(response.status) && options.redirect !== 'manual') {
      response = await globalThis.fetch(new URL(response.headers.get('location'), url), options);
    }
    return response;
  };
}
if (process.env.CONFLORA_IN_PROCESS_HTTP === 'true') installInProcessHttp();
module.exports = { dispatch, installInProcessHttp };
