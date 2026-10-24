const config = require('../src/config/env');
console.log(`Arquivo de ambiente: ${config.envSource.path || '(nenhum)'}; carregado: ${config.envSource.loaded ? 'sim' : 'não'}; origem: ${config.envSource.reason}`);
if (config.envSource.inheritedWhatsAppKeys.length) console.log(`Variáveis herdadas têm precedência sobre o arquivo: ${config.envSource.inheritedWhatsAppKeys.join(', ')}`);

// Local presence checks only: no calls, messages, token values or phone numbers.
const fields = [
  ['WHATSAPP_PHONE_NUMBER_ID', config.whatsapp.phoneNumberId],
  ['WHATSAPP_TOKEN', config.whatsapp.token],
  ['WHATSAPP_VERIFY_TOKEN', config.whatsapp.verifyToken],
  ['META_APP_SECRET', config.whatsapp.metaAppSecret],
  ['WHATSAPP_BUSINESS_ACCOUNT_ID', process.env.WHATSAPP_BUSINESS_ACCOUNT_ID],
  ['WHATSAPP_WELCOME_TEMPLATE', process.env.WHATSAPP_WELCOME_TEMPLATE],
];
let missing = false;
for (const [name, value] of fields) {
  console.log(`${value ? 'OK' : 'AUSENTE'}: ${name}`);
  if (!value) missing = true;
}
console.log(`Assistente automático: ${config.whatsapp.assistantEnabled ? 'ativado' : 'desativado — WHATSAPP_AI_ENABLED não é true; o agente não responderá'}`);
console.log('Esta verificação não comprova validade do token, permissão ou entrega na Meta.');
try { require('../src/integrations/whatsapp-welcome').welcomeContract(); console.log('OK: estrutura local WHATSAPP_WELCOME_CONTRACT'); }
catch (error) { missing = true; console.log(`PENDENTE: WHATSAPP_WELCOME_CONTRACT (${error.diagnosticCode || 'INVALID'}); conferir o modelo aprovado, incluindo CTA URL.`); }
console.log(`Catálogo Meta: ${process.env.WHATSAPP_META_CATALOG_ENABLED === 'true' && process.env.WHATSAPP_META_CATALOG_ID ? 'configurado localmente; vínculo e permissões ainda exigem conferência' : 'pendente; compra por texto disponível'}`);
console.log(`Sincronização Meta: ${process.env.WHATSAPP_META_SYNC_ENABLED === 'true' ? 'habilitada no ambiente; exige autorização persistida' : 'desativada'}`);
process.exitCode = missing ? 1 : 0;
if (process.argv.includes('--require-assistant') && !config.whatsapp.assistantEnabled) process.exitCode = 1;
if (process.argv.includes('--meta')) {
  require('../src/integrations/whatsapp-diagnostics').inspectMetaConfiguration(config).then(result => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 1;
    console.log('Somente leituras na Meta; nenhuma mensagem, alteração de template ou sincronização foi enviada.');
  }).catch(() => { process.exitCode = 1; console.log('Não foi possível concluir as leituras de diagnóstico da Meta.'); });
}
