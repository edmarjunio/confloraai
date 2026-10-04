const { CloudTasksClient } = require("@google-cloud/tasks");
const { config } = require("../config/env");

const client = new CloudTasksClient();

function requireTaskConfig() {
  if (!config.tasks.serviceUrl) {
    throw new Error("SERVICE_URL não configurada.");
  }
  if (!config.tasks.secret) {
    throw new Error("TASK_SECRET não configurado.");
  }
}

async function createHttpTask(path, payload, delaySeconds = 0) {
  requireTaskConfig();

  const parent = client.queuePath(
    config.projectId,
    config.region,
    config.tasks.queue,
  );

  const task = {
    httpRequest: {
      httpMethod: "POST",
      url: `${config.tasks.serviceUrl}${path}`,
      headers: {
        "Content-Type": "application/json",
        "X-Conflora-Task-Secret": config.tasks.secret,
      },
      body: Buffer.from(JSON.stringify(payload || {})).toString("base64"),
    },
  };

  if (delaySeconds > 0) {
    task.scheduleTime = {
      seconds: Math.floor(Date.now() / 1000) + Math.floor(delaySeconds),
    };
  }

  const [response] = await client.createTask({ parent, task });
  return response.name;
}

function scheduleInboundMessage(payload) {
  return createHttpTask("/tasks/processar-mensagem", payload, 0);
}

function scheduleOrderFollowup(orderId, followupToken) {
  return createHttpTask(
    "/tasks/followup-pedido",
    { orderId, followupToken },
    config.tasks.followupSeconds,
  );
}

function scheduleOwnerOrderNotification(orderId) {
  return createHttpTask("/tasks/notificar-venda", { orderId }, 0);
}

function scheduleReceiptForward(payload) {
  return createHttpTask("/tasks/encaminhar-comprovante", payload, 0);
}

module.exports = {
  scheduleInboundMessage,
  scheduleOrderFollowup,
  scheduleOwnerOrderNotification,
  scheduleReceiptForward,
};
