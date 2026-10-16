const config = require('../src/config/env');
const { SicrediPixClient } = require('../src/integrations/sicredi-pix.client');

async function main() {
  const secret = process.env.SICREDI_WEBHOOK_SECRET || '';
  const gatewaySecret = process.env.SICREDI_WEBHOOK_GATEWAY_SECRET || '';
  if (secret.length < 32 && gatewaySecret.length < 32) {
    throw new Error('Configure SICREDI_WEBHOOK_SECRET ou SICREDI_WEBHOOK_GATEWAY_SECRET com pelo menos 32 caracteres aleatórios.');
  }
  let baseUrl;
  try {
    baseUrl = new URL(process.env.SICREDI_WEBHOOK_URL || config.tasks.serviceUrl);
  } catch {
    throw new Error('Configure SERVICE_URL com o endereço HTTPS público do serviço publicado.');
  }
  if (baseUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname)) {
    throw new Error('SERVICE_URL precisa ser público e usar HTTPS para receber eventos do Sicredi.');
  }

  const callbackPath = secret.length >= 32
    ? `/webhooks/sicredi-pix/${encodeURIComponent(secret)}`
    : '/webhooks/sicredi-pix';
  const callbackUrl = new URL(callbackPath, baseUrl).toString();
  const result = await new SicrediPixClient().registerWebhook(callbackUrl);
  console.log('Webhook Sicredi registrado para a chave Pix configurada.');
  console.log(`URL registrada: ${new URL(callbackUrl).origin}${secret.length >= 32 ? '/webhooks/sicredi-pix/[segredo oculto]' : '/webhooks/sicredi-pix'}`);
  const registeredUrl = result?.webhookUrl || result?.webhookURL;
  if (registeredUrl && registeredUrl !== callbackUrl) {
    console.warn('O Sicredi retornou uma URL diferente da solicitada; confira o cadastro no portal Sicredi.');
  }
}

main().catch((error) => {
  console.error(`Falha ao registrar webhook: ${error.message}`);
  process.exitCode = 1;
});
