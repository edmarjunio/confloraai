require('../src/config/env');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { SicrediPixClient } = require('../src/integrations/sicredi-pix.client');
const { WhatsAppClient } = require('../src/integrations/whatsapp.client');
const { SicrediPaymentService } = require('../src/orders/sicredi-payment.service');

async function main() {
  const service = new SicrediPaymentService({ repository: new FirestoreRepository(), client: new SicrediPixClient(), whatsapp: new WhatsAppClient() });
  if (process.argv[2] === '--register-webhook') {
    if (!process.env.SICREDI_WEBHOOK_URL) {throw new Error('Configure SICREDI_WEBHOOK_URL.');}
    await service.client.registerWebhook(process.env.SICREDI_WEBHOOK_URL);
    console.log('Webhook Sicredi cadastrado.');
    return;
  }
  const result = await service.processJobs();
  console.log(JSON.stringify(result));
  if (result.failed) {process.exitCode = 1;}
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
