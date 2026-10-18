const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test('emulador: instâncias concorrentes reivindicam mensagem uma única vez', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async t => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) throw new Error('O teste exige emulador local.');
  const { Firestore } = require('@google-cloud/firestore');
  const { FirestoreRepository } = require('../src/database/firestore.repository');
  const { IncomingMessageService } = require('../src/services/incoming-message.service');
  const db = new Firestore({ projectId: 'demo-conflora-tests' });
  const first = new IncomingMessageService(new FirestoreRepository({ firestoreInstance: db }));
  const second = new IncomingMessageService(new FirestoreRepository({ firestoreInstance: db }));
  const messageId = 'emulator-' + randomUUID();
  const ref = db.collection('incoming_messages').doc(first.id(messageId));
  t.after(async () => { await ref.delete(); await db.terminate(); });
  await first.accept({ messageId, phone: 'test', message: 'isolated' });
  const outcomes = await Promise.allSettled([first.claim(messageId), second.claim(messageId)]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  const claim = outcomes.find(result => result.status === 'fulfilled').value;
  await first.finish(claim);
  assert.equal((await second.claim(messageId)).completed, true);
});
