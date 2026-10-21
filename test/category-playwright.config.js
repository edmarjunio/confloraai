const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './browser',
  testMatch: 'category-ui.spec.js',
  workers: 1,
  use: {headless: true, launchOptions: process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}},
});
