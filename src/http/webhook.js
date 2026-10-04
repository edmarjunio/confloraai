const { config, isProduction } = require("../config/env");
const { isValidMetaSignature } = require("../security/meta-signature");
const { scheduleInboundMessage } = require("../integrations/task-queue.client");
const logger = require("../shared/logger");

function verifyWebhookChallenge(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
}

function hasValidSignature(req) {
  if (!config.whatsapp.appSecret) {
    return !isProduction();
  }

  return isValidMetaSignature(
    req.rawBody,
    req.get("X-Hub-Signature-256"),
    config.whatsapp.appSecret,
  );
}

const { extractInboundMessages } = require("./webhook-parser");

async function receiveWebhook(req, res) {
  if (!hasValidSignature(req)) {
    logger.warn("Webhook rejeitado por assinatura inválida");
    return res.sendStatus(401);
  }

  try {
    const messages = extractInboundMessages(req.body);
    await Promise.all(
      messages.map((message) => scheduleInboundMessage(message)),
    );
    return res.sendStatus(200);
  } catch (error) {
    logger.error("Falha ao enfileirar webhook", {
      error: String(error?.message || error),
    });
    return res.sendStatus(500);
  }
}

module.exports = {
  verifyWebhookChallenge,
  receiveWebhook,
};
