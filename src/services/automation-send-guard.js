const { AsyncLocalStorage } = require('node:async_hooks');
const { conversationAutomation } = require('./conversation-automation');
const context = new AsyncLocalStorage();
const blocked = () => Object.assign(new Error('Envio automático bloqueado por posse humana ou contexto superado.'), { definitelyNotSent: true, automationBlocked: true });
async function assertAutomation(repo, phone, version, { requireAssistant = true } = {}) {
  const config = require('../config/env').whatsapp;
  if (requireAssistant && (!config.assistantEnabled || config.agentOwner !== 'cloud_api')) throw blocked();
  const state = await conversationAutomation(repo, phone);
  if (state.automation === 'paused' || state.assignedTo || version !== undefined && Number(state.version || 0) !== Number(version)) throw blocked();
  return state;
}
function withAutomation(repo, phone, version, send, options = {}) { return context.run({ repo, phone, version, options }, send); }
async function beforeSubmission() {
  const current = context.getStore();
  if (current) await assertAutomation(current.repo, current.phone, current.version, current.options);
}
async function assertTransactionAutomation(tx) {
  const current = context.getStore();
  if (!current) return;
  const { scopedId, customerKeyFor } = require('../agent/agent-store');
  const state = await tx.get('agent_conversations', scopedId('conflora', customerKeyFor('conflora', current.phone)));
  if (state?.automation === 'paused' || state?.assignedTo || Number(state?.version || 0) !== Number(current.version || 0)) throw blocked();
}
module.exports = { assertAutomation, withAutomation, beforeSubmission, assertTransactionAutomation, blocked };
