// Diagnóstico local: nunca imprime valores de credenciais nem chama serviços externos.
const config = require('../src/config/env');

const checks = [
  ['MERCADO_PAGO_ACCESS_TOKEN', Boolean(config.mercadoPago.accessToken)],
  ['MERCADO_PAGO_WEBHOOK_SECRET', Boolean(config.mercadoPago.webhookSecret)],
  ['SERVICE_URL (HTTPS público)', isPublicHttps(config.tasks.serviceUrl)],
];

function isPublicHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

for (const [name, configured] of checks) {
  console.log(`${configured ? 'OK' : 'PENDENTE'}: ${name}`);
}
console.log('Este diagnóstico não valida credenciais na API nem permissões do Firestore.');
console.log(`Ambiente: ${config.appEnvironment}; projeto: ${config.gcp.projectId}; modo real exigido: ${config.mercadoPago.expectedLiveMode === true}`);
process.exitCode = checks.every(([, configured]) => configured) ? 0 : 1;

