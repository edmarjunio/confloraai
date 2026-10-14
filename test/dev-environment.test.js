const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { validateDevEnvironment, isDevServiceUrl } = require('../src/config/dev-environment');

function dev() {
  return {
    appEnvironment: 'dev', gcp: { projectId: 'confloraai-dev' },
    firebase: { projectId: 'confloraai-dev', storageBucket: 'confloraai-dev.firebasestorage.app', authDomain: 'confloraai-dev.firebaseapp.com' },
    tasks: { queue: 'conflora-jobs-dev', serviceUrl: 'https://confloraai-dev.web.app' },
    whatsapp: { token: '', phoneNumberId: '', assistantEnabled: false },
  };
}
test('dev accepts only isolated resources; production keeps its configuration', () => {
  assert.doesNotThrow(() => validateDevEnvironment(dev(), ['confloraai-dev']));
  assert.doesNotThrow(() => validateDevEnvironment({ appEnvironment: 'production', gcp: { projectId: 'confloraai' }, firebase: { projectId: 'confloraai' } }));
});
for (const [section, key, value] of [
  ['gcp', 'projectId', 'confloraai'], ['firebase', 'projectId', 'confloraai'],
  ['firebase', 'storageBucket', 'confloraai.firebasestorage.app'],
  ['firebase', 'authDomain', 'confloraai.firebaseapp.com'],
  ['tasks', 'queue', 'conflora-jobs'], ['tasks', 'serviceUrl', 'https://confloraai.web.app'],
  ['whatsapp', 'token', 'production-token'], ['whatsapp', 'phoneNumberId', '123'],
  ['whatsapp', 'assistantEnabled', true],
]) {
  test(`dev rejects cross-environment setting: ${section}.${key}`, () => {
    const config = dev(); config[section][key] = value;
    assert.throws(() => validateDevEnvironment(config));
  });
}
test('dev rejects a production credential even with explicit dev project IDs', () => {
  assert.throws(() => validateDevEnvironment(dev(), ['confloraai']), /credencial/);
  const config = dev(); config.appEnvironment = 'production';
  assert.throws(() => validateDevEnvironment(config), /APP_ENV=dev/);
});
test('dev callback allowlist rejects deceptive hosts, paths and credentials', () => {
  for (const url of ['http://confloraai-dev.web.app', 'https://confloraai-dev.web.app.attacker.test',
    'https://confloraai-dev.web.app/path', 'https://user@confloraai-dev.web.app',
    'https://confloraai-dev.web.app?target=production', 'https://confloraai-123.southamerica-east1.run.app']) {
    assert.equal(isDevServiceUrl(url), false, url);
  }
  assert.equal(isDevServiceUrl('https://confloraai-dev-123.southamerica-east1.run.app'), true);
  assert.equal(isDevServiceUrl('https://confloraai-dev-abcdef-rj.a.run.app'), true);
});
test('dev loading ignores .env from production and refuses a production service account', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'conflora-env-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(path.join(directory, '.env'), 'GCP_PROJECT_ID=confloraai\nMERCADO_PAGO_ACCESS_TOKEN=do-not-load\n');
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
    APP_ENV: 'dev', GCP_PROJECT_ID: 'confloraai-dev', FIREBASE_PROJECT_ID: 'confloraai-dev',
    SERVICE_URL: 'https://confloraai-dev.web.app', CLOUD_TASKS_QUEUE: 'conflora-jobs-dev' };
  const configPath = require.resolve('../src/config/env');
  const script = `const c = require(${JSON.stringify(configPath)}); if(c.mercadoPago.accessToken) process.exit(7); console.log(c.gcp.projectId)`;
  assert.equal(execFileSync(process.execPath, ['-e', script], { cwd: directory, env, encoding: 'utf8' }).trim(), 'confloraai-dev');
  writeFileSync(path.join(directory, 'firebase-service-account.json'), JSON.stringify({ project_id: 'confloraai' }));
  assert.throws(() => execFileSync(process.execPath, ['-e', script], { cwd: directory, env, stdio: 'pipe' }));
});
test('explicit ADC credentials from another project are rejected before any connection', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'conflora-adc-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const credentials = path.join(directory, 'credential.json');
  writeFileSync(credentials, JSON.stringify({ project_id: 'confloraai' }));
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
    APP_ENV: 'dev', GCP_PROJECT_ID: 'confloraai-dev', FIREBASE_PROJECT_ID: 'confloraai-dev',
    SERVICE_URL: 'https://confloraai-dev.web.app', CLOUD_TASKS_QUEUE: 'conflora-jobs-dev',
    GOOGLE_APPLICATION_CREDENTIALS: credentials };
  assert.throws(() => execFileSync(process.execPath, ['-e', `require(${JSON.stringify(require.resolve('../src/config/env'))})`],
    { cwd: directory, env, stdio: 'pipe' }));
});
