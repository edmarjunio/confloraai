// One-shot read-only checks: never creates orders, moves stock or sends messages.
const config = require('../src/config/env');
async function main() {
  const base = process.env.LIVE_CHECK_URL || config.tasks.serviceUrl || 'https://confloraai.web.app';
  const origin = new URL(base);
  if (origin.protocol !== 'https:') throw new Error('O diagnóstico real exige HTTPS.');
  const results = [];
  const health = await fetch(new URL('/health', origin), { signal: AbortSignal.timeout(15000) });
  let status = {};
  if (health.headers.get('content-type')?.includes('application/json')) status = await health.json();
  results.push({ check: 'backend', http: health.status, revision: status.revision || null, paymentMode: status.paymentProvider || null, manualPixReady: status.paymentProvider === 'MANUAL' });
  const history = await fetch(new URL('/api/admin/errors', origin), { signal: AbortSignal.timeout(15000) });
  results.push({ check: 'history_access_control', http: history.status, protected: [401, 403].includes(history.status) });
  if (config.whatsapp.token && config.whatsapp.phoneNumberId) {
    const url = `https://graph.facebook.com/${config.whatsapp.graphVersion}/${config.whatsapp.phoneNumberId}?fields=display_phone_number,verified_name`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${config.whatsapp.token}` }, signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    results.push({ check: 'whatsapp_connection', http: response.status, verified: response.ok, sender: response.ok ? data.display_phone_number : undefined, providerErrorCode: data.error?.code });
  }
  console.log(JSON.stringify({ origin: origin.origin, checkedAt: new Date().toISOString(), results }, null, 2));
  if (!results[0].manualPixReady) process.exitCode = 1;
}
main().catch(() => { console.error('Diagnóstico incompleto. Confira conexão, URL e credenciais no ambiente.'); process.exitCode = 1; });
