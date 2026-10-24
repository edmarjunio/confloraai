// Bump only for an intentional full reset, not for every deployment.
export const PUBLIC_CACHE_DATABASE = 'cf-public-20261023-real-products1';
export const RETIRED_PUBLIC_DATABASES = ['cf-public-20261023', 'cf-public-20261023-reset1'];

// Never enumerate/delete unrelated databases, authentication or pending operations.
// A blocked deletion stays pending and is retried on the next visit.
export async function purgeRetiredPublicDatabases(factory = globalThis.indexedDB) {
  if (!factory) return [];
  return Promise.all(RETIRED_PUBLIC_DATABASES.map(name => new Promise(resolve => {
    try {
      const request = factory.deleteDatabase(name);
      request.onsuccess = () => resolve({ name, deleted: true });
      request.onerror = request.onblocked = () => resolve({ name, deleted: false });
    } catch { resolve({ name, deleted: false }); }
  })));
}
