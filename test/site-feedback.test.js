const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

test('site feedback receives standalone review and prepares WhatsApp message to owner', async () => {
  // Test endpoint logic directly
  const { createApp } = require('../src/http/app');
  const mockRepo = {
    findCustomerProfilesByEmail: async () => [],
    getCustomerOrderHistoryPage: async () => ({ orders: [] }),
  };
  const mockWhatsapp = {
    sent: [],
    async sendTextMessage(to, text) {
      this.sent.push({ to, text });
      return { messages: [{ id: 'wamid.feedback123' }] };
    },
  };
  const mockStore = {
    saved: [],
    async transaction(fn) {
      const tx = {
        set: (coll, id, data) => {
          mockStore.saved.push({ coll, id, data });
        },
      };
      await fn(tx);
    },
  };

  const app = createApp({
    messageService: {
      firestoreRepo: mockRepo,
      whatsappClient: mockWhatsapp,
    },
    config: {
      whatsapp: { ownerNumber: '5564999361572' },
      gcp: { projectId: 'confloraai' },
    },
    sessions: { resolve: (_req, _res, next) => next() },
  });
  app.locals.pdv = { store: mockStore };

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/site-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Maria Silva',
        phone: '64999998888',
        email: 'maria@example.com',
        rating: 5,
        type: '🌸 Elogio',
        highlights: ['Produtos impecáveis e bem protegidos', 'Atendimento atencioso'],
        comment: 'Adorei as mudas de temperos, chegaram muito viçosas!',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.feedback.name, 'Maria Silva');
    assert.equal(data.feedback.rating, 5);
    assert.equal(data.feedback.type, '🌸 Elogio');
    assert.ok(data.ownerWhatsappUrl.includes('5564999361572'));
    assert.ok(data.ownerWhatsappUrl.includes(encodeURIComponent('Adorei as mudas de temperos')));

    // WhatsApp API was called directly
    assert.equal(mockWhatsapp.sent.length, 1);
    assert.equal(mockWhatsapp.sent[0].to, '5564999361572');
    assert.ok(mockWhatsapp.sent[0].text.includes('Maria Silva'));
    assert.ok(mockWhatsapp.sent[0].text.includes('CONFLORA — NOVA AVALIAÇÃO DO SITE'));
    assert.ok(mockWhatsapp.sent[0].text.includes('5/5'));

    // Stored in site_feedbacks
    assert.equal(mockStore.saved.length, 1);
    assert.equal(mockStore.saved[0].coll, 'site_feedbacks');
  } finally {
    server.close();
  }
});
