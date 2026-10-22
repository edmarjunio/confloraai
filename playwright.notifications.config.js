const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/browser',
  testMatch: 'notifications-and-search.spec.js',
  workers: 1,
  timeout: 20000,
  use: {
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {},
  },
});
