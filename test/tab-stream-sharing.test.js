const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { EventTarget, Event, MessageEvent, Request, TextDecoder, AbortController } = globalThis;

function sessionHarness() {
  const storage = new Map();
  const calls = [];
  const window = new EventTarget();
  Object.assign(window, {
    Headers, Request, EventTarget, Event, MessageEvent, TextDecoder,
    sessionStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    fetch: async (url, options) => {
      if (!String(url).endsWith('/stream')) return Response.json({ success: true });
      calls.push(options);
      const body = new ReadableStream({
        start(controller) {
          options.signal.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true });
        },
      });
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
    },
  });
  vm.runInNewContext(fs.readFileSync('public/storefront/tab-session.js', 'utf8'), {
    window, location: new URL('https://conflora.test/caixa'), URL, AbortController,
    crypto: { randomUUID }, setTimeout, clearTimeout,
  });
  return { session: window.ConfloraSession, calls };
}

test('two consumers share a stream and only the last release aborts it', async () => {
  const { session, calls } = sessionHarness();
  const first = session.openEventStream('/api/caixa/orders/stream');
  const second = session.openEventStream('/api/caixa/orders/stream');
  try {
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 1);
    first.close();
    assert.equal(calls[0].signal.aborted, false);
    second.close();
    assert.equal(calls[0].signal.aborted, true);
  } finally { first.close(); second.close(); }
});

test('different endpoints never share streams and logout closes the old identity', async () => {
  const { session, calls } = sessionHarness();
  const first = session.openEventStream('/api/caixa/orders/stream');
  const customer = session.openEventStream('/api/customer/orders/stream');
  let next;
  try {
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 2);
    await session.apiFetch('/api/auth/logout', { method: 'POST' });
    assert.ok(calls.every(call => call.signal.aborted));
    next = session.openEventStream('/api/caixa/orders/stream');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 3);
    first.close();
    assert.equal(calls[2].signal.aborted, false);
  } finally { first.close(); customer.close(); next?.close(); }
});
