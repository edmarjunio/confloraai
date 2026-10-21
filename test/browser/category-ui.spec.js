const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

// Serve real UI modules through interception so this suite never needs cloud data.
async function openCatalog(page) {
  await page.route('http://categories.test/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname !== '/') {
      const file = resolve(__dirname, '../../public/storefront', pathname.slice(1));
      return route.fulfill({ body: readFileSync(file), contentType: pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    }
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="/store.css"><link rel="stylesheet" href="/design-system.css">
      <script>Object.defineProperty(String.prototype, 'tr', {get() {return this.toString();}});</script>
      <script src="/category-ui.js"></script><script src="/render-image.js"></script><script src="/product-card.js"></script>
      </head><body><main id="catalogView"><input id="search"><select id="sortOrder"><option value="az">az</option></select>
      <div id="categoryFilterControl"></div><div id="subcategoryFilterControl"></div>
      <h1 id="catalogTitle"></h1><span id="resultCount"></span><div id="products" class="products"></div>
      <button id="loadMore"></button></main><div id="productView" hidden></div>
      <script type="module">
        import {createCatalog} from '/catalog.js';
        const names = ['Horta', 'Hortifrutti', 'Pets'];
        const products = names.map((category, i) => ({id: 'p' + i, name: category + ' produto', categories: ['c' + i],
          categoryName: category, status: 'ATIVO', subcategory: i === 0 ? 'Temperos' : '',
          price: {amountMinor: 500}, stock: {tracked: false}, saleUnit: {minimum: 1}}));
        const state = {slug: 'test', products, config: {categories: names.map((name,i) => ({id: 'c'+i, name}))}};
        window.catalog = createCatalog(state, () => {}, () => {});
        window.catalog.render();
      </script></body></html>` });
  });
  await page.goto('http://categories.test/');
  await expect(page.locator('#products render-product-card')).toHaveCount(3);
}

test('category filters combine selections, deselect, reset and keep subcategory filtering', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openCatalog(page);
  const filter = name => page.locator('#categoryFilterControl').getByRole('button', { name, exact: true });
  await filter('Horta').click();
  await expect(page.locator('#products render-product-card')).toHaveCount(1);
  await page.locator('#subcategoryFilterControl').getByRole('button', { name: 'Temperos', exact: true }).click();
  await expect(page.locator('#products render-product-card')).toHaveCount(1);
  await filter('Pets').click();
  await expect(page.locator('#products render-product-card')).toHaveCount(2);
  await expect(filter('Horta')).toHaveAttribute('aria-pressed', 'true');
  await expect(filter('Pets')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#subcategoryFilterControl')).toBeHidden();
  await filter('Horta').click();
  await expect(page.locator('#products render-product-card')).toHaveCount(1);
  await expect(page.locator('#products')).toContainText('Pets produto');
  await filter('Todas').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#products render-product-card')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('filters and card badges share colors in desktop, mobile and selected states', async ({ page }) => {
  await openCatalog(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width, height: 900});
    const filter = page.locator('#categoryFilterControl').getByRole('button', { name: 'Horta', exact: true });
    await page.locator('#categoryFilterControl').getByRole('button', { name: 'Todas', exact: true }).click();
    const soft = await filter.evaluate(node => ({background: getComputedStyle(node).backgroundColor, border: getComputedStyle(node).borderTopColor}));
    await filter.click();
    const strong = await filter.evaluate(node => getComputedStyle(node).backgroundColor);
    expect(strong).toBe(soft.border);
    expect(strong).not.toBe(soft.background);
    const badge = page.locator('#products .cf-category-tag').first();
    expect(await badge.evaluate(node => getComputedStyle(node).backgroundColor)).toBe(strong);
    expect(await badge.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect(await filter.evaluate(node => node.getBoundingClientRect().right <= innerWidth)).toBe(true);
  }
});
