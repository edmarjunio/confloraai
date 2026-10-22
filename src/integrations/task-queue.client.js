const config = require('../config/env');
const Logger = require('../shared/logger');
const { createHash } = require('node:crypto');

let cloudTasksModule = null;
function getCloudTasksModule() {
  if (!cloudTasksModule) {
    try {
      cloudTasksModule = require('@google-cloud/tasks');
    } catch {
      return null;
    }
  }
  return cloudTasksModule;
}

class TaskQueueClient {
  constructor() {
    this.client = null;
    this.queuePath = null;

    if (config.tasks.serviceUrl && process.env.NODE_ENV !== 'test') {
      try {
        const tasks = getCloudTasksModule();
        if (tasks && tasks.CloudTasksClient) {
          this.client = new tasks.CloudTasksClient();
          this.queuePath = this.client.queuePath(
            config.gcp.projectId,
            config.gcp.region,
            config.tasks.queue
          );
        }
      } catch (err) {
        Logger.warn('Cloud Tasks client não inicializado; operando em modo local direto.', { error: err.message });
      }
    }
  }

  /**
   * Enqueues an incoming webhook message to be processed asynchronously.
   * @param {Object} payload
   */
  async enqueueProcessMessage(payload) {
    if (!this.client || !this.queuePath) {
      Logger.debug('Cloud Tasks ausente; processando internamente em background.');
      return { inProcess: true };
    }

    const url = `${config.tasks.serviceUrl}/tasks/processar-mensagem`;
    const httpRequest = {
      httpMethod: 'POST',
      url,
      headers: {
        'Content-Type': 'application/json',
        'X-Conflora-Task-Secret': config.tasks.taskSecret,
      },
      body: Buffer.from(JSON.stringify({ messageId: payload.messageId })).toString('base64'),
    };

    try {
      const [response] = await this.client.createTask({
        parent: this.queuePath,
        task: { httpRequest },
      });
      Logger.info(`Tarefa Cloud Tasks criada: ${response.name}`);
      return response;
    } catch (error) {
      Logger.error('Falha ao criar tarefa no Cloud Tasks', error);
      throw error;
    }
  }

  /**
   * Enqueues a delayed follow-up task for unconfirmed orders.
   * @param {string} phone
   * @param {number} delaySeconds
   */
  async enqueueFollowUp(phone, delaySeconds = config.tasks.followupSeconds) {
    if (!this.client || !this.queuePath) {
      return { inProcess: true };
    }

    const url = `${config.tasks.serviceUrl}/tasks/follow-up`;
    const scheduleTime = {
      seconds: Math.floor(Date.now() / 1000) + delaySeconds,
    };

    const httpRequest = {
      httpMethod: 'POST',
      url,
      headers: {
        'Content-Type': 'application/json',
        'X-Conflora-Task-Secret': config.tasks.taskSecret,
      },
      body: Buffer.from(JSON.stringify({ phone })).toString('base64'),
    };

    try {
      const [response] = await this.client.createTask({
        parent: this.queuePath,
        task: { httpRequest, scheduleTime },
      });
      Logger.info(`Follow-up agendado para ${delaySeconds}s: ${response.name}`);
      return response;
    } catch (error) {
      Logger.error('Falha ao agendar follow-up no Cloud Tasks', error);
      throw error;
    }
  }

  async enqueuePixExpiration(orderId, ttlSeconds = 3600) {
    if (!this.client || !this.queuePath) {
      if (process.env.NODE_ENV === 'production') throw new Error('Cloud Tasks não está configurado para expirar reservas Pix.');
      return { inProcess: true };
    }
    if (!config.tasks.taskSecret) throw new Error('TASK_SECRET não configurado para expirar reservas Pix.');
    const delay = Math.min(86400, Math.max(300, Number(ttlSeconds) || 3600)) + 5;
    const taskId = 'expire-pix-' + createHash('sha256').update(String(orderId)).digest('hex').slice(0, 32);
    const taskName = this.client.taskPath(config.gcp.projectId, config.gcp.region, config.tasks.queue, taskId);
    try {
      const [task] = await this.client.createTask({
        parent: this.queuePath,
        task: {
          name: taskName,
          scheduleTime: { seconds: Math.floor(Date.now() / 1000) + delay },
          httpRequest: {
            httpMethod: 'POST',
            url: `${config.tasks.serviceUrl}/tasks/expire-pix`,
            headers: { 'Content-Type': 'application/json', 'X-Conflora-Task-Secret': config.tasks.taskSecret },
            body: Buffer.from(JSON.stringify({ orderId })).toString('base64'),
          },
        },
      });
      return task;
    } catch (error) {
      if (error.code === 6 || /already exists/i.test(error.message || '')) return { alreadyScheduled: true, name: taskName };
      Logger.error('Falha ao agendar expiração da reserva Pix', { orderId, error: error.message });
      throw error;
    }
  }
}

module.exports = {
  TaskQueueClient,
};
