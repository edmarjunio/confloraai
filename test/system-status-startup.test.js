const test = require('node:test');
const assert = require('node:assert/strict');
const { SystemStatusService } = require('../src/services/system-status.service');

test('startup diagnostics report only active integrations', async () => {
  const service = new SystemStatusService({});
  const status = await service.getSystemStatus();
  assert.equal('defaultCatalog' in status, false);
});
