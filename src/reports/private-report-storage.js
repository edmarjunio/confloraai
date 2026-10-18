const { randomUUID } = require('node:crypto');
const { privateBucket } = require('../orders/payment-proof');
class PrivateReportStorage {
  constructor(repository) { this.repository = repository; repository.privateReports ||= new Map(); }
  async save(buffer) {
    const name = `${randomUUID()}.pdf`;
    if (this.repository.isInMemory && !this.repository.firestore) this.repository.privateReports.set(name, buffer);
    else await privateBucket().file(`private-reports/${name}`).save(buffer, { resumable: false, metadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' } });
    return name;
  }
  async read(name) {
    if (!/^[a-f0-9-]{36}\.pdf$/.test(name || '')) throw new Error('Relatório inválido.');
    if (this.repository.isInMemory && !this.repository.firestore) return this.repository.privateReports.get(name);
    return (await privateBucket().file(`private-reports/${name}`).download())[0];
  }
}
module.exports = { PrivateReportStorage };
