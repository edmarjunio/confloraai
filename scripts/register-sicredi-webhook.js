const config = require('../src/config/env');
const { SicrediPixClient } = require('../src/integrations/sicredi-pix.client');

async function main() {
  const secret = process.env.SICREDI_WEBHOOK_SECRET || '';
  if (secret.length < 32) {
    throw new Error('Configure SICREDI_WEBHOOK_SECRET com pelo menos 32 caracteres aleatórios antes de registrar o webhook.');
  }
  let baseUrl;
  try {
    baseUrl = new URL(config.tasks.serviceUrl);
  } catch {
    throw new Error('Configure SERVICE_URL com o endereço HTTPS público do serviço publicado.');
  }
  if (baseUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname)) {
    throw new Error('SERVICE_URL precisa ser público e usar HTTPS para receber eventos do Sicredi.');
  }

  const callbackUrl = new URL(`/webhooks/sicredi-pix/${encodeURIComponent(secret)}`, baseUrl).toString();
  const result = await new SicrediPixClient().registerWebhook(callbackUrl);
  console.log('Webhook Sicredi registrado para a chave Pix configurada.');
  console.log(`URL registrada: ${new URL(callbackUrl).origin}/webhooks/sicredi-pix/[segredo oculto]`);
  if (result?.webhookURL && result.webhookURL !== callbackUrl) {
    console.warn('O Sicredi retornou uma URL diferente da solicitada; confira o cadastro no portal Sicredi.');
  }
}

main().catch((error) => {
  console.error(`Falha ao registrar webhook: ${error.message}`);
  process.exitCode = 1;
});
