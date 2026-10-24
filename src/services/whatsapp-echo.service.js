const { PdvRepository } = require('../orders/pdv.repository');
const { conversationAutomation } = require('./conversation-automation');
/** Only subscribed, signed smb_message_echoes events are accepted by the webhook. */
async function processHumanEcho(repository, value) {
  const store = new PdvRepository(repository);
  for (const echo of Array.isArray(value?.message_echoes) ? value.message_echoes : []) {
    const phone = String(echo.to || '');
    if (!/^\d{10,15}$/.test(phone) || typeof echo.id !== 'string' || !echo.id.startsWith('wamid.')) continue;
    const providerKey = require('node:crypto').createHash('sha256').update(echo.id).digest('hex');
    if (await store.read('whatsapp_delivery', providerKey)) continue;
    const own = await store.scanPage('pdv_outbox', 'providerMessageId', echo.id, 1);
    const manual = await store.scanPage('whatsapp_delivery', 'providerMessageId', echo.id, 1);
    if (own.length || manual.length) continue;
    // No message or typing is fabricated. Unknown echoes fail safely toward human ownership.
    await conversationAutomation(repository, phone, { pauseReason: 'smb_human_message_echo', messageId: echo.id, echoEventId: echo.id });
  }
}
module.exports = { processHumanEcho };
