const test = require('node:test');
const assert = require('node:assert/strict');
const { SystemStatusService } = require('../src/services/system-status.service');

test('startup diagnostics do not depend on the removed static catalog', async () => {
  const service = new SystemStatusService({});
  const status = await service.getSystemStatus();
  assert.equal(status.defaultCatalog.status, 'DISABLED');
  assert.equal(status.defaultCatalog.totalItems, 0);
});
