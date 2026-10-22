const { randomUUID } = require('node:crypto');
const { runTransaction } = require('../database/transactions');
const { customerKeyFor, scopedId } = require('../agent/agent-store');

async function conversationAutomation(repo, phone, { pauseReason, messageId = '' } = {}) {
  const tenantId = 'conflora';
  const customerKey = customerKeyFor(tenantId, phone);
  const id = scopedId(tenantId, customerKey);
  return runTransaction(repo, async tx => {
    const current = await tx.get('agent_conversations', id) || { tenantId, customerKey, automation: 'active' };
    if (current.tenantId !== tenantId || current.customerKey !== customerKey) throw new Error('CONVERSATION_ISOLATION');
    if (!pauseReason || current.automation === 'paused') return current;
    const now = new Date().toISOString();
    const handoffId = `hf_${messageId ? customerKeyFor(tenantId, messageId) : randomUUID()}`;
    const paused = { ...current, automation: 'paused', handoffId, reason: pauseReason, pausedAt: now, updatedAt: now };
    tx.set('agent_handoffs', handoffId, { id: handoffId, tenantId, customerKey, reason: pauseReason, status: 'open', createdAt: now, cartPreserved: true });
    tx.set('agent_conversations', id, paused);
    return paused;
  });
}

module.exports = { conversationAutomation };
