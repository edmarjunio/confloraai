const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./test/browser",
  testMatch: ['state-management.spec.js', 'storefront-layout.spec.js', 'shared-layout.spec.js'],
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8099",
    channel: "msedge",
    locale: "pt-BR",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node test/browser-server.js",
    url: "http://127.0.0.1:8099/health",
    reuseExistingServer: false,
  },
});
