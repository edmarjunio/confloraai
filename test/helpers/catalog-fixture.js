const { CatalogRepository: Catalog } = require('../../src/catalog/catalog.repository');

class CatalogRepository extends Catalog {
  constructor({ mockData, ...options } = {}) {
    super({ ...options, ...(mockData ? { firestoreRepo: { getAllProducts: async () => structuredClone(mockData) } } : {}) });
    if (mockData) this.loadItems(mockData);
  }
}
module.exports = { CatalogRepository };
