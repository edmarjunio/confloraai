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

async function resumeAgentRequestedConversation(repo, phone) {
  const tenantId = 'conflora';
  const customerKey = customerKeyFor(tenantId, phone);
  const conversationId = scopedId(tenantId, customerKey);

  return runTransaction(repo, async tx => {
    const current = await tx.get('agent_conversations', conversationId);
    if (!current || current.automation !== 'paused' || current.reason !== 'human_requested') return current;

    const now = new Date().toISOString();
    if (current.handoffId) {
      const handoff = await tx.get('agent_handoffs', current.handoffId);
      if (handoff?.status === 'open') {
        tx.set('agent_handoffs', current.handoffId, {
          ...handoff,
          status: 'resumed',
          resumedAt: now,
          resumedBy: { id: 'whatsapp_agent', role: 'AGENT' },
        });
      }
    }

    const resumed = {
      ...current,
      automation: 'active',
      resumedAt: now,
      resumedBy: 'whatsapp_agent',
      updatedAt: now,
    };
    tx.set('agent_conversations', conversationId, resumed);
    return resumed;
  });
}

module.exports = { conversationAutomation, resumeAgentRequestedConversation };
