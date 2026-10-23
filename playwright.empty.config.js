const base = require('./playwright.config');
module.exports = { ...base, testMatch: 'empty-database.spec.js', use: { ...base.use, baseURL: 'http://127.0.0.1:8101' },
  webServer: { command: 'node test/browser-server.js', url: 'http://127.0.0.1:8101/health', reuseExistingServer: false,
    env: { BROWSER_EMPTY_DATABASE: 'true', BROWSER_TEST_PORT: '8101' } } };
