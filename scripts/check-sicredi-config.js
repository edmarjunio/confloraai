const config = require('../src/config/env');
const { SicrediPixClient } = require('../src/integrations/sicredi-pix.client');

function isPublicHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

const checks = [
  ['SICREDI_CLIENT_ID', Boolean(config.sicredi.clientId)],
  ['SICREDI_CLIENT_SECRET', Boolean(config.sicredi.clientSecret)],
  ['SICREDI_CERT_PEM', Boolean(config.sicredi.certificate)],
  ['SICREDI_KEY_PEM', Boolean(config.sicredi.privateKey)],
  ['SICREDI_PIX_KEY', Boolean(config.sicredi.pixKey)],
  ['SICREDI_WEBHOOK_SECRET (mínimo 32 caracteres)', (process.env.SICREDI_WEBHOOK_SECRET || '').length >= 32],
  ['SERVICE_URL (HTTPS público)', isPublicHttps(config.tasks.serviceUrl)],
  ['PDV_WORKER_SECRET', Boolean(process.env.PDV_WORKER_SECRET)],
];

for (const [name, configured] of checks) {
  console.log(`${configured ? 'OK' : 'PENDENTE'}: ${name}`);
}

if (process.argv.includes('--connect')) {
  if (!checks.slice(0, 5).every(([, configured]) => configured)) {
    console.error('Não foi possível validar a conexão: complete as credenciais Sicredi acima.');
    process.exitCode = 1;
  } else {
    const client = new SicrediPixClient();
    client.getAccessToken()
      .then(() => console.log('OK: Sicredi emitiu o token OAuth; nenhuma cobrança foi criada.'))
      .catch((error) => {
        console.error(`FALHA: Sicredi recusou a autenticação (${error.message}).`);
        process.exitCode = 1;
      });
  }
} else {
  console.log('Verificação local apenas; use --connect depois de configurar as credenciais para validar OAuth sem gerar cobrança.');
  if (checks.some(([, configured]) => !configured)) process.exitCode = 1;
}
