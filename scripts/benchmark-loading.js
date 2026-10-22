const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');
const { dispatch } = require('../test/helpers/in-process-http');
require('./test-env');

async function createFixture(sourceRoot) {
  const { createApp } = require(path.join(sourceRoot, 'src/http/app'));
  const { FirestoreRepository } = require(path.join(sourceRoot, 'src/database/firestore.repository'));
  const repo = new FirestoreRepository({ isInMemory: true });
  for (let i = 0; i < 120; i++) await repo.saveProduct({
    id: 'bench-' + i, name: 'Produto ' + String(i).padStart(3, '0'),
    price: 10 + i, stockQuantity: 100, category: 'Horta', status: 'ATIVO',
  });
  return createApp({ messageService: { firestoreRepo: repo, catalogRepo: { items: [], refreshCatalog: async () => {} } } });
}
async function run(sourceRoot, samples = 3) {
  const app = await createFixture(sourceRoot);
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (let sample = 0; sample < samples; sample++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      let requests = 0, bytes = 0, catalogRequests = 0;
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__loadingBenchmark = { lcp: null, cls: 0, ready: null };
        try {
          new PerformanceObserver(list => { window.__loadingBenchmark.lcp = list.getEntries().at(-1).startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
          new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__loadingBenchmark.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
        } catch {}
        const observer = new MutationObserver(() => {
          if (document.querySelectorAll('#products .product-card').length >= 24) {
            window.__loadingBenchmark.ready = performance.now(); observer.disconnect();
          }
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      if (process.env.DEBUG_LOADING) page.on('console', message => console.log(message.type(), message.text().slice(0, 500)));
      await context.route('**/*', async route => {
        const req = route.request();
        const url = new URL(req.url());
        if (url.hostname !== 'conflora.test') return route.abort();
        requests++;
        if (url.pathname === '/api/storefront/catalog') catalogRequests++;
        await new Promise(resolve => setTimeout(resolve, 50));
        const response = await dispatch(app, url, { method: req.method(), headers: req.headers(), body: req.postData() });
        const body = Buffer.from(await response.arrayBuffer());
        if (process.env.DEBUG_LOADING) console.log(req.method(), url.pathname, response.status, body.length);
        bytes += body.length;
        const headers = Object.fromEntries(response.headers.entries());
        delete headers['transfer-encoding']; delete headers['content-length'];
        await route.fulfill({ status: response.status, headers, body });
      });
      for (const visit of ['cold', 'warm']) {
        requests = bytes = catalogRequests = 0;
        if (visit === 'cold') await page.goto('https://conflora.test/');
        else await page.reload();
        try { await page.waitForFunction(() => document.querySelectorAll('#products .product-card').length >= 24, null, { timeout: 15000 }); }
        catch (error) { console.error({ errors, body: await page.locator('body').innerText().then(value => value.slice(0, 1500)) }); throw error; }
        await page.waitForTimeout(150);
        const performance = await page.evaluate(() => ({
          ready: window.__loadingBenchmark.ready,
          ...performance.getEntriesByType('navigation').map(entry => ({ domContentLoaded: entry.domContentLoadedEventEnd, ttfb: entry.responseStart - entry.startTime }))[0],
          lcp: window.__loadingBenchmark.lcp,
          cls: window.__loadingBenchmark.cls,
        }));
        results.push({ sample, visit, requests, responseBodyBytes: bytes, catalogRequests, ...performance, errors: [...errors] });
      }
      await context.close();
    }
  } finally { await browser.close(); }
  return { sourceRoot, simulatedRequestLatencyMs: 50, samples, results };
}
if (require.main === module) {
  const sourceRoot = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  run(sourceRoot, Number(process.argv[4]) || 3).then(result => {
    if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run, createFixture };
