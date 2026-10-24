const { createHash } = require('node:crypto');

function idDiagnostic(value) {
  const text = typeof value === 'string' ? value : '';
  return { present: Boolean(text), type: typeof value, digitsOnly: /^\d+$/.test(text),
    fingerprint: text ? createHash('sha256').update(text).digest('hex').slice(0, 12) : null,
    suffix: text ? `…${text.slice(-4)}` : null };
}
function eventDiagnostic(entry, change, config, env = process.env) {
  const expectedAccount = env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const expectedPhone = config.whatsapp.phoneNumberId;
  const actualAccount = entry?.id;
  const actualPhone = change?.value?.metadata?.phone_number_id;
  const accountMatches = Boolean(expectedAccount) && actualAccount === expectedAccount;
  const phoneMatches = Boolean(expectedPhone) && actualPhone === expectedPhone;
  return { code: 'WHATSAPP_EVENT_ACCOUNT_MISMATCH', field: change?.field || 'missing', accountMatches, phoneMatches,
    reasons: [!expectedAccount ? 'CONFIG_WABA_MISSING' : !actualAccount ? 'EVENT_WABA_MISSING' : !accountMatches ? 'WABA_MISMATCH' : null,
      !expectedPhone ? 'CONFIG_PHONE_ID_MISSING' : !actualPhone ? 'EVENT_PHONE_ID_MISSING' : !phoneMatches ? 'PHONE_ID_MISMATCH' : null].filter(Boolean),
    expectedAccount: idDiagnostic(expectedAccount), receivedAccount: idDiagnostic(actualAccount),
    expectedPhone: idDiagnostic(expectedPhone), receivedPhone: idDiagnostic(actualPhone),
    envFile: config.envSource?.path, envFileLoaded: config.envSource?.loaded,
    revision: env.K_REVISION || env.APP_REVISION || 'local', assistantEnabled: config.whatsapp.assistantEnabled };
}
async function inspectMetaConfiguration(config, env = process.env, fetcher = fetch) {
  const get = async path => {
    try {
      const response = await fetcher(`https://graph.facebook.com/${config.whatsapp.graphVersion}/${path}`, {
        headers: { Authorization: `Bearer ${config.whatsapp.token}` }, signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      return response.ok ? { ok: true, data } : { ok: false, httpStatus: response.status, graphCode: data.error?.code, graphSubcode: data.error?.error_subcode };
    } catch (error) { return { ok: false, networkError: error.name }; }
  };
  const accountId = env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
  const phoneId = config.whatsapp.phoneNumberId;
  const templateName = env.WHATSAPP_WELCOME_TEMPLATE || '';
  const [phone, account, numbers, templates] = await Promise.all([
    get(`${phoneId}?fields=id,verified_name`), get(`${accountId}?fields=id,name`),
    get(`${accountId}/phone_numbers?fields=id&limit=100`),
    get(`${accountId}/message_templates?name=${encodeURIComponent(templateName)}&fields=name,language,status,components,parameter_format&limit=100`),
  ]);
  const phoneMatches = phone.ok && phone.data.id === phoneId;
  const accountMatches = account.ok && account.data.id === accountId;
  const phoneBelongs = numbers.ok && Array.isArray(numbers.data.data) && numbers.data.data.some(row => row.id === phoneId);
  const found = templates.ok && Array.isArray(templates.data.data) ? templates.data.data.filter(row => row.name === templateName && row.language === config.whatsapp.templates.language) : [];
  const current = found.length === 1 ? found[0] : null;
  const reasons = [];
  let contract;
  try { contract = require('./whatsapp-welcome').welcomeContract(env); }
  catch (error) { reasons.push(error.diagnosticCode || 'WELCOME_CONTRACT_INVALID'); }
  if (!current) reasons.push('META_TEMPLATE_NOT_UNIQUE_OR_UNAVAILABLE');
  else {
    if (current.status !== 'APPROVED') reasons.push('META_TEMPLATE_NOT_APPROVED');
    const header = current.components.find(component => component.type === 'HEADER');
    const body = current.components.find(component => component.type === 'BODY');
    const buttons = current.components.find(component => component.type === 'BUTTONS')?.buttons || [];
    const parameterIndexes = [...new Set([...String(body?.text || '').matchAll(/\{\{(\d+)\}\}/g)].map(match => Number(match[1])))];
    if (contract) {
      if (header?.format !== contract.header) reasons.push('META_HEADER_FORMAT_MISMATCH');
      if (current.parameter_format && current.parameter_format !== 'POSITIONAL' || parameterIndexes.length !== contract.bodyParameters.length || parameterIndexes.some((index, position) => index !== position + 1)) reasons.push('META_BODY_PARAMETERS_MISMATCH');
      if (contract.bodyParameters.includes('greeting_fragment') && !/Olá\{\{1\}\}eja/.test(body?.text || '')) reasons.push('META_GREETING_FRAGMENT_MISMATCH');
      if (buttons.length !== contract.buttons.length || buttons.some((button, index) => button.type !== contract.buttons[index]?.type || button.text !== contract.buttons[index]?.text || button.type === 'URL' && button.url !== contract.buttons[index]?.url)) reasons.push('META_BUTTON_CONTRACT_MISMATCH');
    }
  }
  const safe = result => result.ok ? { ok: true } : result;
  return { readOnly: true, graphVersion: config.whatsapp.graphVersion,
    phone: { ...safe(phone), id: idDiagnostic(phoneId), idMatches: phoneMatches, verifiedName: phone.ok ? phone.data.verified_name : undefined },
    account: { ...safe(account), id: idDiagnostic(accountId), idMatches: accountMatches, containsConfiguredPhone: phoneBelongs },
    accountNumbers: { ...safe(numbers), hasMore: Boolean(numbers.data?.paging?.next) },
    template: { ...safe(templates), name: templateName, language: current?.language, status: current?.status, contractMatches: reasons.length === 0, reasons },
    passed: Boolean(phoneMatches && accountMatches && phoneBelongs && reasons.length === 0) };
}
module.exports = { idDiagnostic, eventDiagnostic, inspectMetaConfiguration };
