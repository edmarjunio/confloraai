const { timingSafeEqual } = require('node:crypto');
function validTaskSecret(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !expected) return false;
  const left = Buffer.from(provided), right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function incomingTaskHandler({ incoming, messageService, config }) {
  return async (req, res) => {
    if (!config.whatsapp.assistantEnabled) return res.status(410).json({ error: 'Atendimento automático desativado.' });
    if (!validTaskSecret(req.headers['x-conflora-task-secret'], config.tasks.taskSecret)) return res.sendStatus(401);
    const id = req.body?.messageId;
    if (typeof id !== 'string' || !id || id.length > 512) return res.status(400).json({ error: 'Identificador da mensagem inválido.' });
    try {
      const accepted = await incoming.store.read('incoming_messages', incoming.id(id));
      if (accepted?.status === 'COMPLETED') return res.status(200).json({ intent: 'DUPLICATE', reply: '' });
      if (!accepted?.payload) return res.status(409).json({ error: 'Mensagem sem evento de entrada persistido.' });
      // Queue/body fields are transport hints; only the signed, persisted webhook owns the payload.
      return res.status(200).json(await messageService.handleCustomerMessage(accepted.payload));
    } catch (error) {
      require('../shared/logger').error('Erro ao processar mensagem via Cloud Tasks', error);
      return res.status(503).json({ error: 'Processamento temporariamente indisponível.' });
    }
  };
}

module.exports = { incomingTaskHandler, validTaskSecret };
