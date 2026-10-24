const { randomUUID } = require('node:crypto');
const { runTransaction } = require('../database/transactions');
const { customerKeyFor, scopedId } = require('../agent/agent-store');

async function conversationAutomation(repo, phone, { pauseReason, messageId = '', echoEventId = '' } = {}) {
  const tenantId = 'conflora';
  const customerKey = customerKeyFor(tenantId, phone);
  const id = scopedId(tenantId, customerKey);
  return runTransaction(repo, async tx => {
    const current = await tx.get('agent_conversations', id) || { tenantId, customerKey, automation: 'active' };
    if (current.tenantId !== tenantId || current.customerKey !== customerKey) throw new Error('CONVERSATION_ISOLATION');
    if (echoEventId) {
      const eventId = require('node:crypto').createHash('sha256').update(`echo:${echoEventId}`).digest('hex');
      if (await tx.get('incoming_messages', eventId)) return current;
      tx.set('incoming_messages', eventId, { id: eventId, status: 'COMPLETED', payload: { phone, messageId: echoEventId, message: '[MENSAGEM_HUMANA_OBSERVADA]', type: 'smb_message_echoes' }, completedAt: new Date().toISOString(), expiresAt: null });
    }
    if (!pauseReason || current.automation === 'paused') return current;
    const now = new Date().toISOString();
    const handoffId = `hf_${messageId ? customerKeyFor(tenantId, messageId) : randomUUID()}`;
    const paused = { ...current, automation: 'paused', attentionStatus: 'NEEDS_HUMAN_ATTENTION', version: Number(current.version || 0) + 1, handoffId, reason: pauseReason, pausedAt: now, updatedAt: now, customerPhone: phone };
    tx.set('agent_handoffs', handoffId, { id: handoffId, tenantId, customerKey, reason: pauseReason, status: 'open', createdAt: now, cartPreserved: true });
    tx.set('agent_conversations', id, paused);
    return paused;
  });
}

async function resumeAgentRequestedConversation(repo, phone, actor) {
  if (!actor?.id || !['ADMIN', 'CAIXA', 'VENDEDOR'].includes(actor.role)) throw Object.assign(new Error('Operador autorizado obrigatório.'), { status: 403 });
  const tenantId = 'conflora';
  const customerKey = customerKeyFor(tenantId, phone);
  const conversationId = scopedId(tenantId, customerKey);

  return runTransaction(repo, async tx => {
    const current = await tx.get('agent_conversations', conversationId);
    if (!current || current.automation !== 'paused') return current;
    if (current.assignedTo && current.assignedTo.id !== actor.id && actor.role !== 'ADMIN') throw Object.assign(new Error('Conversa atribuída a outro operador.'), { status: 409 });

    const now = new Date().toISOString();
    if (current.handoffId) {
      const handoff = await tx.get('agent_handoffs', current.handoffId);
      if (handoff?.status === 'open') {
        tx.set('agent_handoffs', current.handoffId, {
          ...handoff,
          status: 'resumed',
          resumedAt: now,
          resumedBy: { id: actor.id, role: actor.role },
        });
      }
    }

    const resumed = {
      ...current,
      automation: 'active',
      resumedAt: now,
      resumedBy: actor.id, assignedTo: null, attentionStatus: 'RESOLVED', version: Number(current.version || 0) + 1,
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

    const updated = { ...current, channel, customerPhone: phone, updatedAt: new Date().toISOString() };
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
      customerPhone: phone,
      lastSessionDate: tzDateStr,
      sessionStartedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      ...(current.automation === 'active' ? { channel: 'menu' } : {}),
    };

    tx.set('agent_conversations', conversationId, updated);
    return { isNewDay: true, current: updated };
  });
}

async function resetConversationContext(repo, phone, actor = null) {
  const id = scopedId('conflora', customerKeyFor('conflora', phone));
  return runTransaction(repo, async tx => {
    const current = await tx.get('agent_conversations', id) || { tenantId: 'conflora', customerKey: customerKeyFor('conflora', phone), automation: 'active' };
    const session = await tx.get('sessions', phone) || {};
    // Preserve every commercial draft and pending operation. Archive only conversational working context.
    const sales = session.salesConversation;
    const now = new Date().toISOString();
    const archiveId = `context-reset-${customerKeyFor('conflora', phone)}-${Number(current.version || 0) + 1}`;
    if (sales) tx.set('agent_handoffs', archiveId, { id: archiveId, kind: 'CONVERSATION_CONTEXT_ARCHIVE', status: 'closed',
      tenantId: 'conflora', customerKey: customerKeyFor('conflora', phone), customerPhone: phone, salesConversation: sales,
      createdAt: now, archivedBy: actor?.id || 'customer', commercialDataPreserved: true });
    tx.set('sessions', phone, { ...session, salesConversation: null, previousSalesConversation: sales || session.previousSalesConversation || null });
    const updated = { ...current, channel: 'menu', version: Number(current.version || 0) + 1, contextResetAt: now, contextResetBy: actor?.id || 'customer', updatedAt: now };
    tx.set('agent_conversations', id, updated);
    return { preservedContextId: sales ? archiveId : null, conversation: updated };
  });
}
module.exports = { conversationAutomation, resumeAgentRequestedConversation, setConversationChannel, evaluateDailyReset, resetConversationContext };
