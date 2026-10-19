const { randomUUID } = require('node:crypto');
const Logger = require('../shared/logger');

function installErrorCapture(app, history, { capture = process.env.NODE_ENV !== 'test' } = {}) {
  if (capture) Logger.setErrorSink(entry => history.capture(entry));
  app.use((req, res, next) => {
    req.requestId ||= randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    res.on('finish', () => {
      if (!capture || res.statusCode < 500 || res.locals.errorCaptured) return;
      Logger.error('Falha ao atender uma operação', null, { source: 'HTTP', requestId: req.requestId, method: req.method, route: req.route?.path || 'unknown', status: res.statusCode });
    });
    next();
  });
}

function installErrorHistoryRoutes(app, history) {
  // Registration follows the existing ADMIN authorization middleware.
  app.get('/api/admin/errors', async (req, res) => {
    try { res.set('Cache-Control', 'private, no-store').json(await history.list({ before: String(req.query.before || '') })); }
    catch (error) { res.status(error.status || 503).json({ error: 'Não foi possível carregar o histórico. Consulte os logs do servidor.' }); }
  });
  const buckets = new Map();
  let globalMinute = 0; let globalCount = 0;
  app.post('/api/client-errors', (req, res) => {
    const origin = req.get('Origin');
    if (origin) { try { if (new URL(origin).host !== req.get('host')) return res.sendStatus(403); } catch { return res.sendStatus(403); } }
    const minute = Math.floor(Date.now() / 60000);
    if (minute !== globalMinute) { buckets.clear(); globalMinute = minute; globalCount = 0; }
    const attempts = buckets.get(req.ip) || 0;
    if (attempts >= 5 || globalCount >= 100 || buckets.size >= 256 && !buckets.has(req.ip)) return res.sendStatus(429);
    buckets.set(req.ip, attempts + 1); globalCount++;
    const input = req.body || {};
    if (typeof input.message !== 'string' || !input.message.trim()) return res.sendStatus(400);
    const cleanPath = value => { try { const url = new URL(value, 'https://local.invalid'); return url.pathname.slice(0, 200); } catch { return ''; } };
    const record = { level: 'ERROR', source: 'BROWSER', message: input.message.slice(0, 1000), error: { stack: String(input.stack || '').slice(0, 4000) }, page: cleanPath(input.page), file: cleanPath(input.file), line: Math.max(0, Math.min(1000000, Number(input.line) || 0)), requestId: req.requestId, revision: process.env.K_REVISION || 'local' };
    // Browser reports are bounded and treated as untrusted text in the admin.
    history.capture(record);
    res.sendStatus(202);
  });
}
module.exports = { installErrorCapture, installErrorHistoryRoutes };
