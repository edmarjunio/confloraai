const { AsyncLocalStorage } = require('node:async_hooks');
const { conversationAutomation } = require('./conversation-automation');
const context = new AsyncLocalStorage();
const blocked = () => Object.assign(new Error('Envio automático bloqueado por posse humana ou contexto superado.'), { definitelyNotSent: true, automationBlocked: true });
async function assertAutomation(repo, phone, version) {
  const config = require('../config/env').whatsapp;
  if (!config.assistantEnabled || config.agentOwner !== 'cloud_api') throw blocked();
  const state = await conversationAutomation(repo, phone);
  if (state.automation === 'paused' || state.assignedTo || version !== undefined && Number(state.version || 0) !== Number(version)) throw blocked();
  return state;
}
function withAutomation(repo, phone, version, send) { return context.run({ repo, phone, version }, send); }
async function beforeSubmission() {
  const current = context.getStore();
  if (current) await assertAutomation(current.repo, current.phone, current.version);
}
module.exports = { assertAutomation, withAutomation, beforeSubmission, blocked };
