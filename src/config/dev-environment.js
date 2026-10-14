const DEV_PROJECT = 'confloraai-dev';

function isDevServiceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      url.pathname === '/' && !url.search && !url.hash &&
      ([`${DEV_PROJECT}.web.app`, `${DEV_PROJECT}.firebaseapp.com`].includes(url.hostname) ||
        /^confloraai-dev-[a-z0-9-]+\.a\.run\.app$/.test(url.hostname) ||
        /^confloraai-dev-\d+\.southamerica-east1\.run\.app$/.test(url.hostname));
  } catch {
    return false;
  }
}

// Run before constructing any database, queue, auth or storage client.
function validateDevEnvironment(config, credentialProjects = []) {
  const projects = [config.gcp.projectId, config.firebase.projectId];
  if (config.appEnvironment !== 'dev') {
    if (projects.includes(DEV_PROJECT)) {
      throw new Error('O projeto confloraai-dev exige APP_ENV=dev.');
    }
    return;
  }
  if (projects.some((project) => project !== DEV_PROJECT) ||
      credentialProjects.some((project) => project !== DEV_PROJECT)) {
    throw new Error('Ambiente dev bloqueado: projeto ou credencial fora de confloraai-dev.');
  }
  if (![`confloraai-dev.firebasestorage.app`, `confloraai-dev.appspot.com`].includes(config.firebase.storageBucket)) {
    throw new Error('Ambiente dev bloqueado: bucket deve pertencer a confloraai-dev.');
  }
  if (config.firebase.authDomain &&
      !['confloraai-dev.firebaseapp.com', 'confloraai-dev.web.app'].includes(config.firebase.authDomain)) {
    throw new Error('Ambiente dev bloqueado: Firebase Auth aponta para outro ambiente.');
  }
  if (config.tasks.queue !== 'conflora-jobs-dev' || !isDevServiceUrl(config.tasks.serviceUrl)) {
    throw new Error('Ambiente dev exige fila conflora-jobs-dev e SERVICE_URL HTTPS do dev.');
  }
  if (config.whatsapp.token || config.whatsapp.phoneNumberId || config.whatsapp.assistantEnabled) {
    throw new Error('WhatsApp real está desabilitado no ambiente dev de pagamentos.');
  }
}

module.exports = { DEV_PROJECT, isDevServiceUrl, validateDevEnvironment };
