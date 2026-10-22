const { defineConfig } = require('@playwright/test');
const fs = require('node:fs');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
module.exports = defineConfig({
  testDir: './test/loading', workers: 1, timeout: 25000,
  use: { baseURL: 'https://conflora.test', serviceWorkers: 'block', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium-mobile', use: { viewport: { width: 390, height: 844 } } },
    { name: 'chromium-desktop', use: { viewport: { width: 1440, height: 900 } } },
    ...(process.env.LOADING_TEST_EDGE === 'true' && fs.existsSync(edge) ? [{ name: 'edge-desktop', use: { viewport: { width: 1440, height: 900 }, launchOptions: { executablePath: edge } } }] : []),
  ],
});
