const { expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');

async function ensureCashierSession(client) {
  const origin = typeof client.url === 'function' && /^https?:/.test(client.url()) ? new URL(client.url()).origin : '';
  const identity = await client.request.get(origin + '/api/auth/me');
  if (!identity.ok()) return;
  const { user } = await identity.json();
  if (!['ADMIN', 'CAIXA'].includes(user?.role)) return;
  const status = await client.request.get(origin + '/api/caixa/closing-status');
  if ((await status.json()).mySession) return;
  const response = await client.request.post(origin + '/api/caixa/open-my-cashier', {
    data: { requestId: randomUUID(), openingFloat: 0 },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

module.exports = { ensureCashierSession };
