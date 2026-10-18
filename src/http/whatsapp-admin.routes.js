function installWhatsappAdminRoutes(app, { whatsapp }) {
  app.post('/api/admin/whatsapp/verify', async (_req, res) => {
    if (process.env.NODE_ENV === 'test') return res.status(409).json({ error: 'Conexões reais desativadas nos testes.' });
    try {
      const response = await fetch(whatsapp.baseUrl + '?fields=display_phone_number,verified_name', { headers: { Authorization: `Bearer ${whatsapp.token}` }, signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      whatsapp.lastConnectionCheck = { status: response.ok ? 'VERIFIED' : 'ERROR', checkedAt: new Date().toISOString() };
      res.status(response.ok ? 200 : 502).json({ ...whatsapp.lastConnectionCheck, sender: data.display_phone_number || '', error: data.error?.message });
    } catch { res.status(502).json({ error: 'Não foi possível verificar o remetente.' }); }
  });
  app.get('/api/admin/whatsapp/settings', (_req, res) => res.json({ configured: Boolean(whatsapp?.token && process.env.WHATSAPP_PHONE_NUMBER_ID), storePhone: process.env.STORE_NOTIFICATION_PHONE || '', ownerPhone: process.env.OWNER_WHATSAPP_NUMBER || '' }));
}
module.exports = { installWhatsappAdminRoutes };
