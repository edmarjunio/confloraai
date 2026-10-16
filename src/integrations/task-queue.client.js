const config = require('../config/env');
const Logger = require('../shared/logger');

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
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
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
}

module.exports = {
  TaskQueueClient,
};
