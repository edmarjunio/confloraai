process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ErrorHistoryService } = require('../src/services/error-history.service');
const Logger = require('../src/shared/logger');
const { createApp } = require('../src/http/app');
const { FirestoreRepository } = require('../src/database/firestore.repository');

test('histórico não guarda segredos, deduplica falhas repetidas e pagina sem perder registros do mesmo instante', async () => {
  const history = new ErrorHistoryService({ inMemory: true });
  await history.capture({ level: 'ERROR', message: 'Falha Bearer token-confidencial cpf 529.982.247-25 cliente@example.test', token: 'oculto', error: { message: 'pedido 1' } });
  await history.capture({ level: 'ERROR', message: 'Falha Bearer token-confidencial cpf 529.982.247-25 cliente@example.test', token: 'oculto', error: { message: 'pedido 1' } });
  for (let index = 0; index < 4; index++) await history.capture({ level: 'ERROR', message: 'Falha ' + index });
  const first = await history.list({ limit: 3 }); const second = await history.list({ limit: 3, before: first.nextCursor });
  const entries = [...first.entries, ...second.entries];
  assert.equal(entries.length, 5); assert.equal(new Set(entries.map(row => row.id)).size, 5);
  const data = JSON.stringify(entries); assert.doesNotMatch(data, /token-confidencial|529\.982|cliente@example/);
  assert.match(data, /REDACTED/);
  await assert.rejects(history.list({ before: '../../secret' }), /Página inválida/);
});

test('histórico local sobrevive a outra instância e falha do banco não quebra a operação', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'conflora-errors-'));
  t.after(async () => { await fs.unlink(path.join(directory, 'errors.jsonl')); await fs.rmdir(directory); });
  const query = { orderBy() { return this; }, limit() { return this; }, get: async () => ({ docs: [] }), doc: () => ({ set: async () => { throw new Error('indisponível'); } }) };
  const firestore = { collection: () => query };
  const first = new ErrorHistoryService({ directory, firestore });
  await first.capture({ level: 'ERROR', message: 'Falha de conexão sem dados de cliente' });
  assert.ok(first.lastPersistenceError);
  assert.equal((await first.list()).entries.length, 1);
  const second = new ErrorHistoryService({ directory });
  const { entries } = await second.list(); assert.equal(entries.length, 1);
  assert.equal(entries[0].message, 'Falha de conexão sem dados de cliente');
});

test('Logger tolera metadados circulares e falha do destino sem quebrar venda', t => {
  const previous = Logger.errorSink;
  t.after(() => Logger.setErrorSink(previous));
  t.mock.method(console, 'error', () => {});
  Logger.setErrorSink(() => { throw new Error('logging indisponível'); });
  const circular = {}; circular.self = circular;
  assert.doesNotThrow(() => Logger.error('erro', new Error('detalhe'), { circular }));
});

test('somente admin acessa histórico; falhas do navegador têm limite e rotas de simulação foram retiradas', async t => {
  const repository = new FirestoreRepository({ isInMemory: true });
  const app = createApp({ messageService: { firestoreRepo: repository, catalogRepo: { refreshCatalog: async () => {}, items: [] } } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const get = (url, cookie) => fetch(base + url, { headers: cookie ? { cookie } : {} });
  const post = (url, data, cookie) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(data) });
  assert.equal((await get('/api/admin/errors')).status, 401);
  const cashier = await post('/api/admin/auth/login', { userId: 'usr-caixa1', pin: '0000' });
  assert.equal((await get('/api/admin/errors', cashier.headers.get('set-cookie').split(';')[0])).status, 403);
  const admin = await post('/api/admin/auth/login', { userId: 'usr-edmar', pin: '1234' });
  const cookie = admin.headers.get('set-cookie').split(';')[0];
  assert.equal((await post('/api/client-errors', { message: 'TypeError: Cannot set property fetch of #<Window> which has only a getter', stack: 'at chrome-extension://almalgbpmcfpdaopimbdchdliminoign/executors/200.js:1:26303', file: 'chrome-extension://almalgbpmcfpdaopimbdchdliminoign/executors/200.js', page: '/' })).status, 204);
  for (let index = 0; index < 5; index++) assert.equal((await post('/api/client-errors', { message: 'Falha demonstrativa isolada ' + index, stack: 'Token Bearer segredo', page: '/?acesso=privado' })).status, 202);
  assert.equal((await post('/api/client-errors', { message: 'Excedente' })).status, 429);
  await app.locals.errorHistory.queue;
  const result = await get('/api/admin/errors', cookie); const body = await result.json();
  assert.equal(result.status, 200); assert.equal(body.entries.length, 5);
  assert.ok(body.entries.every(entry => entry.page === '/'));
  assert.doesNotMatch(JSON.stringify(body), /privado|segredo|chrome-extension/);
  assert.equal((await get('/simulador')).status, 404);
  assert.equal((await post('/chat', {})).status, 404);
  assert.equal((await post('/api/admin/whatsapp/test', {}, cookie)).status, 404);
});
