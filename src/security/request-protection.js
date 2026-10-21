const { createHash, randomUUID } = require('node:crypto');

function contentSecurityPolicy(env = process.env) {
  const studioPreview = (env.NODE_ENV || 'development') === 'development' && env.AI_STUDIO_PREVIEW_EMBED === 'true';
  const ancestors = studioPreview ? "'self' https://aistudio.google.com" : "'self'";
  return `frame-ancestors ${ancestors}; object-src 'none'; base-uri 'self'`;
}

function installRequestProtection(app, repository) {
  const buckets = new Map();
  // Cache only a denial proven by the shared database. Never authorize from process memory.
  const denied = new Map();
  const framePolicy = contentSecurityPolicy();
  app.use((req, res, next) => {
    req.requestId ||= randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', framePolicy);
    next();
  });
  app.use('/api', async (req, res, next) => {
    const action = /\/auth\/(login|register|google)$/.test(req.path) ? 'auth' : /^\/meta-agent\//.test(req.path) ? 'connector' : /\/ai\/|\/assistant$|^\/chat$/.test(req.path) ? 'ai' : null;
    if (!action || req.method !== 'POST') return next();
    const minute = Math.floor(Date.now() / 60000);
    const maximum = action === 'auth' ? Math.max(1, Number(process.env.REQUEST_AUTH_LIMIT) || 15) : action === 'connector' ? 60 : 8;
    // Never trust caller-supplied forwarding headers without an explicitly configured proxy.
    const account = String(req.body?.email || req.body?.userId || '').toLowerCase().trim().slice(0, 200);
    const identity = account ? action + ':account:' + account : action + ':' + req.ip;
    const keys = [...new Set([action + ':' + req.ip, identity])].map(value => createHash('sha256').update(`${value}:${minute}`).digest('hex'));
    try {
      if (repository.firestore) {
        for (const [key, until] of denied) if (until <= Date.now()) denied.delete(key);
        const denialKey = `${maximum}:${keys.join(':')}`;
        if (denied.has(denialKey)) throw Object.assign(new Error('Muitas tentativas. Aguarde um minuto.'), { status: 429 });
        try { await repository.firestore.runTransaction(async tx => {
          const refs = keys.map(key => repository.firestore.collection('request_limits').doc(key));
          const records = await Promise.all(refs.map(ref => tx.get(ref)));
          if (records.some(row => Number(row.data()?.count || 0) >= maximum)) throw Object.assign(new Error('Muitas tentativas. Aguarde um minuto.'), { status: 429 });
          refs.forEach((ref, index) => tx.set(ref, { count: Number(records[index].data()?.count || 0) + 1, expiresAt: new Date((minute + 2) * 60000) }));
        }); } catch (error) {
          if (error.status === 429 && denied.size < 10000) {
            // The rejected account may differ from the IP bucket. Cache only this exact tuple.
            denied.set(denialKey, (minute + 1) * 60000);
          }
          throw error;
        }
      } else {
        if (keys.some(key => (buckets.get(key)?.count || 0) >= maximum)) throw Object.assign(new Error('Muitas tentativas. Aguarde um minuto.'), { status: 429 });
        keys.forEach(key => buckets.set(key, { count: (buckets.get(key)?.count || 0) + 1, minute }));
        for (const [key, bucket] of buckets) if (bucket.minute < minute - 1) buckets.delete(key);
      }
      next();
    } catch (error) {
      if (error.status === 429) res.setHeader('Retry-After', '60');
      res.status(error.status || 503).json({ code: error.status === 429 ? 'RATE_LIMITED' : 'UNAVAILABLE', error: error.status === 429 ? error.message : 'Proteção de acesso indisponível. Tente novamente.' });
    }
  });
}
module.exports = { installRequestProtection, contentSecurityPolicy };
