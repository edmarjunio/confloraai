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

async function setConversationChannel(repo, phone, channel) {
  const tenantId = 'conflora';
  const customerKey = customerKeyFor(tenantId, phone);
  const conversationId = scopedId(tenantId, customerKey);
  const allowedChannels = new Set(['menu', 'catalog', 'cart', 'agent']);
  if (!allowedChannels.has(channel)) throw new Error('INVALID_CONVERSATION_CHANNEL');

  return runTransaction(repo, async tx => {
    const current = await tx.get('agent_conversations', conversationId) || {
      tenantId,
      customerKey,
      automation: 'active',
    };
    if (current.tenantId !== tenantId || current.customerKey !== customerKey) throw new Error('CONVERSATION_ISOLATION');
    if (current.automation === 'paused') return current;

    const updated = { ...current, channel, updatedAt: new Date().toISOString() };
    tx.set('agent_conversations', conversationId, updated);
    return updated;
  });
}

/**
 * Avalia a mudança de data (America/Sao_Paulo) no primeiro atendimento do dia.
 * Preserva histórico, comandas e Pix pendentes; expira rascunhos sem confirmação.
 */
async function evaluateDailyReset(repo, phone, { now = new Date() } = {}) {
  const tenantId = 'conflora';
  const customerKey = customerKeyFor(tenantId, phone);
  const conversationId = scopedId(tenantId, customerKey);
  const tzDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);

  return runTransaction(repo, async tx => {
    const current = await tx.get('agent_conversations', conversationId) || {
      tenantId,
      customerKey,
      automation: 'active',
    };
    const lastDate = current.lastSessionDate || '';
    if (lastDate === tzDateStr) return { isNewDay: false, current };

    const updated = {
      ...current,
      lastSessionDate: tzDateStr,
      sessionStartedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      ...(current.automation === 'active' ? { channel: 'menu' } : {}),
    };

    tx.set('agent_conversations', conversationId, updated);
    return { isNewDay: true, current: updated };
  });
}

module.exports = { conversationAutomation, resumeAgentRequestedConversation, setConversationChannel, evaluateDailyReset };
