const config = require('../src/config/env');

// Local presence checks only: no calls, messages, token values or phone numbers.
const fields = [
  ['WHATSAPP_PHONE_NUMBER_ID', config.whatsapp.phoneNumberId],
  ['WHATSAPP_TOKEN', config.whatsapp.token],
  ['WHATSAPP_VERIFY_TOKEN', config.whatsapp.verifyToken],
  ['META_APP_SECRET', config.whatsapp.metaAppSecret],
];
let missing = false;
for (const [name, value] of fields) {
  console.log(`${value ? 'OK' : 'AUSENTE'}: ${name}`);
  if (!value) missing = true;
}
console.log(`Assistente automático: ${config.whatsapp.assistantEnabled ? 'ativado' : 'desativado (recebimento de comprovantes)'}`);
console.log('Esta verificação não comprova validade do token, permissão ou entrega na Meta.');
process.exitCode = missing ? 1 : 0;
