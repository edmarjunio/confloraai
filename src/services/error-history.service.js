const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { redact } = require('../shared/logger');

const MAX_PENDING = 32;
const MAX_FILE_BYTES = 1024 * 1024;

/** Bounded error-only persistence. No polling, request bodies, or credentials. */
class ErrorHistoryService {
  constructor({ firestore = null, directory = path.resolve(__dirname, '../../.private/logs'), inMemory = false } = {}) {
    Object.assign(this, { firestore, directory, inMemory });
    this.recent = [];
    this.pending = 0;
    this.queue = Promise.resolve();
    this.lastPersistenceError = null;
    this.fingerprints = new Map();
  }

  capture(entry) {
    if (this.pending >= MAX_PENDING) return Promise.resolve(false);
    const fingerprint = [entry.source, entry.message, entry.error?.message, entry.route, entry.status].join(':').slice(0, 1000);
    const previous = this.fingerprints.get(fingerprint) || 0;
    if (Date.now() - previous < 60000) return Promise.resolve(false);
    if (this.fingerprints.size >= 256) this.fingerprints.delete(this.fingerprints.keys().next().value);
    this.fingerprints.set(fingerprint, Date.now());
    const record = { ...redact(entry), id: randomUUID(), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 86400000) };
    this.pending++;
    const operation = this.queue.then(async () => {
      this.recent.unshift(record);
      this.recent.length = Math.min(this.recent.length, 200);
      if (!this.inMemory) await this.appendFile(record);
      if (this.firestore) {
        let timeout;
        try {
          await Promise.race([
            this.firestore.collection('application_errors').doc(record.id).set(record),
            new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('ERROR_HISTORY_TIMEOUT')), 5000); timeout.unref?.(); }),
          ]);
          this.lastPersistenceError = null;
        } catch {
          this.lastPersistenceError = 'Não foi possível gravar o histórico central. Consulte os logs do servidor.';
        } finally { clearTimeout(timeout); }
      }
      return true;
    });
    this.queue = operation.catch(() => {
      this.lastPersistenceError = 'Histórico local indisponível. Consulte os logs do servidor.';
    }).finally(() => { this.pending--; });
    return this.queue;
  }

  async appendFile(record) {
    await fs.mkdir(this.directory, { recursive: true });
    const current = path.join(this.directory, 'errors.jsonl');
    const size = await fs.stat(current).then(info => info.size).catch(() => 0);
    if (size >= MAX_FILE_BYTES) {
      await fs.rm(path.join(this.directory, 'errors.3.jsonl'), { force: true });
      for (let index = 2; index >= 0; index--) {
        const source = path.join(this.directory, index ? `errors.${index}.jsonl` : 'errors.jsonl');
        try { await fs.rename(source, path.join(this.directory, `errors.${index + 1}.jsonl`)); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    }
    await fs.appendFile(current, JSON.stringify(record) + '\n', { mode: 0o600 });
  }

  async list({ before = '', limit = 50 } = {}) {
    const count = Math.min(50, Math.max(1, Number(limit) || 50));
    let cursor;
    if (before) {
      try {
        if (!/^[A-Za-z0-9_-]{1,180}$/.test(before)) throw new Error('INVALID_CURSOR');
        cursor = JSON.parse(Buffer.from(before, 'base64url').toString());
        if (!Number.isFinite(Date.parse(cursor.createdAt)) || new Date(cursor.createdAt).toISOString() !== cursor.createdAt || !/^[a-f0-9-]{36}$/.test(cursor.id)) throw new Error('INVALID_CURSOR');
      } catch { throw Object.assign(new Error('Página inválida.'), { status: 400 }); }
    }
    let records;
    let source = this.inMemory ? 'memory' : 'local';
    if (this.firestore) {
      try {
        let query = this.firestore.collection('application_errors').orderBy('createdAt', 'desc').orderBy('__name__', 'desc').limit(count + 1);
        if (cursor) query = query.startAfter(cursor.createdAt, cursor.id);
        records = (await query.get()).docs.map(doc => ({ ...doc.data(), id: doc.id }));
        source = 'firestore';
      } catch { this.lastPersistenceError = 'Histórico central indisponível. Mostrando os registros desta instância.'; }
    }
    if (!records || this.lastPersistenceError) {
      records = [...(records || []), ...this.recent];
      if (!this.inMemory) {
        // Rotation bounds disk usage; read only the current file and its predecessor.
        for (const file of ['errors.jsonl', 'errors.1.jsonl']) {
          const data = await fs.readFile(path.join(this.directory, file), 'utf8').catch(() => '');
          for (const line of data.split('\n')) { try { if (line) records.push(JSON.parse(line)); } catch { /* Ignore incomplete final writes. */ } }
        }
      }
      source = this.inMemory ? 'memory' : 'local_fallback';
    }
    records = [...new Map([...records, ...this.recent].map(row => [row.id, row])).values()]
      .filter(row => !cursor || row.createdAt < cursor.createdAt || row.createdAt === cursor.createdAt && row.id < cursor.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).slice(0, count + 1);
    const hasMore = records.length > count;
    const entries = records.slice(0, count).map(({ expiresAt: _expiresAt, ...row }) => row);
    const last = entries.at(-1);
    return { entries, nextCursor: hasMore ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString('base64url') : null, source, warning: this.lastPersistenceError };
  }
}
module.exports = { ErrorHistoryService };
