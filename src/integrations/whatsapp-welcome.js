/** Configuration must be copied from the approved template; never guess its variables. */
function welcomeContract(env = process.env) {
  const fail = diagnosticCode => { throw Object.assign(new Error('Contrato do template aprovado pendente de conferência operacional.'), { diagnosticCode, definitelyNotSent: true, requiresReconciliation: true }); };
  if (!env.WHATSAPP_WELCOME_CONTRACT) fail('WELCOME_CONTRACT_MISSING');
  let contract;
  try { contract = JSON.parse(env.WHATSAPP_WELCOME_CONTRACT); } catch { fail('WELCOME_CONTRACT_INVALID_JSON'); }
  if (!contract) fail('WELCOME_CONTRACT_EMPTY');
  if (contract.name !== env.WHATSAPP_WELCOME_TEMPLATE) fail('WELCOME_TEMPLATE_NAME_MISMATCH');
  if (contract.language !== (env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR')) fail('WELCOME_TEMPLATE_LANGUAGE_MISMATCH');
  if (!contract || !env.WHATSAPP_WELCOME_TEMPLATE || contract.name !== env.WHATSAPP_WELCOME_TEMPLATE || contract.status !== 'APPROVED' ||
      !contract.verifiedAt || contract.language !== (env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR') || contract.header !== 'IMAGE' ||
      !Array.isArray(contract.bodyParameters) || !contract.bodyParameters.every(value => ['customer_name', 'greeting_fragment'].includes(value)) ||
      contract.buttons?.length !== 3 || contract.buttons[0]?.type !== 'URL' || contract.buttons[0]?.text !== 'Catálogo virtual' ||
      contract.buttons[1]?.type !== 'QUICK_REPLY' || contract.buttons[1]?.text !== 'Montar minha sacola' ||
      contract.buttons[2]?.type !== 'QUICK_REPLY' || contract.buttons[2]?.text !== 'Falar com atendente') fail('WELCOME_COMPONENTS_MISMATCH');
  const url = env.WHATSAPP_CATALOG_URL || env.STORE_URL;
  if (!url || !/^https:\/\//.test(url)) fail('WELCOME_CATALOG_HTTPS_URL_MISSING');
  const approved = contract.buttons[0];
  if (approved.mode === 'static' && approved.url !== url) fail('WELCOME_STATIC_URL_MISMATCH');
  else if (approved.mode === 'dynamic') {
    if (!approved.url?.endsWith('{{1}}') || !url.startsWith(approved.url.slice(0, -5)) || !url.slice(approved.url.length - 5)) fail('WELCOME_DYNAMIC_URL_MISMATCH');
  } else if (approved.mode !== 'static') fail('WELCOME_URL_MODE_INVALID');
  return { ...contract, url };
}
function welcomeComponents(contract, customerName, image) {
  const name = String(customerName || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 100);
  const components = [{ type: 'header', parameters: [{ type: 'image', image }] }];
  if (contract.bodyParameters.length) components.push({ type: 'body', parameters: contract.bodyParameters.map(parameter => ({ type: 'text', text: parameter === 'customer_name' ? name || 'cliente' : name ? ` ${name}, s` : '! S' })) });
  if (contract.buttons[0].mode === 'dynamic') components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: contract.url.slice(contract.buttons[0].url.length - 5) }] });
  components.push(...['montar_sacola', 'btn_atendente'].map((payload, index) => ({ type: 'button', sub_type: 'quick_reply', index: String(index + 1), parameters: [{ type: 'payload', payload }] })));
  return components;
}
module.exports = { welcomeContract, welcomeComponents };
