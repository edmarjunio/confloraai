const express = require("express");
const { config, isProduction } = require("../config/env");
const { onlyDigits } = require("../shared/text");
const logger = require("../shared/logger");
const { verifyWebhookChallenge, receiveWebhook } = require("./webhook");
const {
  processTextMessage,
  processInboundMessage,
  runOrderFollowup,
  runOwnerOrderNotification,
  runReceiptForward,
} = require("../services/message.service");
const { setHumanMode } = require("../database/firestore.repository");

function captureRawBody(req, _res, buffer) {
  req.rawBody = Buffer.from(buffer);
}

function requireTaskSecret(req, res, next) {
  if (!config.tasks.secret) {
    return res.status(500).json({ error: "TASK_SECRET não configurado" });
  }

  if (req.get("X-Conflora-Task-Secret") !== config.tasks.secret) {
    return res.sendStatus(403);
  }

  return next();
}

function requireAdminSecret(req, res, next) {
  if (!config.adminSecret) {
    return res.status(500).json({ error: "ADMIN_SECRET não configurado" });
  }

  if (req.get("X-Conflora-Admin-Secret") !== config.adminSecret) {
    return res.sendStatus(403);
  }

  return next();
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
}

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb", verify: captureRawBody }));

  app.get("/", (_req, res) => {
    res.json({ status: "ok", project: "Conflora AI", version: "2.1.0" });
  });

  app.get("/webhook", verifyWebhookChallenge);
  app.post("/webhook", receiveWebhook);

  if (!isProduction()) {
    app.post(
      "/chat",
      asyncHandler(async (req, res) => {
        const message = String(req.body?.mensagem || "").trim();
        const phone = onlyDigits(req.body?.telefone || "5564000000000");
        const profileName =
          String(req.body?.nome || "Cliente").trim() || "Cliente";

        if (!message) {
          return res.status(400).json({ error: "mensagem obrigatória" });
        }

        const result = await processTextMessage({
          phone,
          profileName,
          message,
          sendToWhatsApp: false,
        });

        return res.json({ message, ...result });
      }),
    );
  }

  app.post(
    "/tasks/processar-mensagem",
    requireTaskSecret,
    asyncHandler(async (req, res) =>
      res.json(await processInboundMessage(req.body || {})),
    ),
  );

  app.post(
    "/tasks/followup-pedido",
    requireTaskSecret,
    asyncHandler(async (req, res) =>
      res.json(await runOrderFollowup(req.body || {})),
    ),
  );

  app.post(
    "/tasks/notificar-venda",
    requireTaskSecret,
    asyncHandler(async (req, res) =>
      res.json(await runOwnerOrderNotification(req.body || {})),
    ),
  );

  app.post(
    "/tasks/encaminhar-comprovante",
    requireTaskSecret,
    asyncHandler(async (req, res) =>
      res.json(await runReceiptForward(req.body || {})),
    ),
  );

  app.post(
    "/admin/retomar-ia",
    requireAdminSecret,
    asyncHandler(async (req, res) => {
      const phone = onlyDigits(req.body?.telefone || "");
      if (!phone) {
        return res.status(400).json({ error: "telefone obrigatório" });
      }

      await setHumanMode(phone, false);
      return res.json({ ok: true, telefone: phone, mode: "ia" });
    }),
  );

  app.use((error, _req, res, _next) => {
    logger.error("Erro HTTP não tratado", {
      error: String(error?.message || error),
    });
    res.status(500).json({ error: "internal_server_error" });
  });

  return app;
}

module.exports = { createApp };
