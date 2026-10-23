/**
 * TanStack Query Client Architecture for Storefront
 * Implements QueryClient, QueryCache, queries with stale-while-revalidate,
 * mutations, and cache invalidation.
 */

class QueryCache {
  constructor() {
    this.queries = new Map();
    this.subscribers = new Map();
  }

  hashKey(key) {
    if (Array.isArray(key)) {
      return JSON.stringify(key);
    }
    return String(key);
  }

  get(key) {
    const hash = this.hashKey(key);
    return this.queries.get(hash);
  }

  set(key, data, options = {}) {
    const hash = this.hashKey(key);
    const entry = {
      data,
      updatedAt: Date.now(),
      staleTime: options.staleTime ?? 1000 * 60 * 2, // 2 minutes
      isFetching: false,
      error: null,
    };
    this.queries.set(hash, entry);
    this.notify(hash, entry);
    return entry;
  }

  isStale(key) {
    const entry = this.get(key);
    if (!entry) {
      return true;
    }
    return Date.now() - entry.updatedAt > entry.staleTime;
  }

  subscribe(key, callback) {
    const hash = this.hashKey(key);
    if (!this.subscribers.has(hash)) {
      this.subscribers.set(hash, new Set());
    }
    this.subscribers.get(hash).add(callback);
    return () => {
      const set = this.subscribers.get(hash);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.subscribers.delete(hash);
        }
      }
    };
  }

  notify(hash, entry) {
    const set = this.subscribers.get(hash);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(entry);
        } catch (e) {
          console.error('Query subscription error:', e);
        }
      });
    }
  }

  invalidate(key) {
    const prefix = Array.isArray(key) ? key : [key];
    for (const [hash, entry] of this.queries.entries()) {
      let candidate;
      try { candidate = JSON.parse(hash); } catch { candidate = [hash]; }
      if (Array.isArray(candidate) && prefix.every((part, index) => JSON.stringify(part) === JSON.stringify(candidate[index]))) {
        entry.updatedAt = 0; // Mark stale
        this.notify(hash, entry);
      }
    }
  }
}

export class QueryClient {
  constructor(options = {}) {
    this.cache = new QueryCache();
    this.inFlight = new Map();
    this.defaultOptions = options.defaultOptions || {
      queries: {
        staleTime: 0,
        retry: 1,
      },
    };
  }

  async fetchQuery({ queryKey, queryFn, staleTime }) {
    const hash = this.cache.hashKey(queryKey);
    if (this.inFlight.has(hash)) return this.inFlight.get(hash);

    const pending = (async () => {
      try {
        const data = await queryFn();
        this.cache.set(queryKey, data, {
          staleTime: staleTime ?? this.defaultOptions.queries.staleTime,
        });
        return data;
      } catch (err) { throw err; }
    })();
    this.inFlight.set(hash, pending);
    try {
      return await pending;
    } finally {
      if (this.inFlight.get(hash) === pending) this.inFlight.delete(hash);
    }
  }

  getQueryData(queryKey) {
    return this.cache.get(queryKey)?.data;
  }

  setQueryData(queryKey, data, options) {
    this.cache.set(queryKey, data, options);
  }

  invalidateQueries({ queryKey }) {
    this.cache.invalidate(queryKey);
  }

  subscribe(queryKey, callback) {
    return this.cache.subscribe(queryKey, callback);
  }

  async mutate({ mutationFn, onSuccess, onError, onSettled }) {
    try {
      const result = await mutationFn();
      if (onSuccess) {
        await onSuccess(result);
      }
      if (onSettled) {
        await onSettled(result, null);
      }
      return result;
    } catch (error) {
      if (onError) {
        await onError(error);
      }
      if (onSettled) {
        await onSettled(null, error);
      }
      throw error;
    }
  }
}

// Global TanStack QueryClient singleton instance
export const queryClient = new QueryClient();

// Query Keys
export const QUERY_KEYS = {
  catalog: (slug) => ['catalog', slug || 'conflora'],
  product: (id) => ['product', String(id)],
  teamUsers: () => ['teamUsers'],
  config: (slug) => ['config', slug || 'conflora'],
};

/**
 * High-level data operations powered by TanStack Query
 */
export const storeQueries = {
  /**
   * Fetch Catalog with caching and revalidation
   */
  async getCatalog(slug = 'conflora', apiFn) {
    return queryClient.fetchQuery({
      queryKey: QUERY_KEYS.catalog(slug),
      queryFn: async () => {
        if (apiFn) {
          return await apiFn('/products');
        }
        const res = await window.ConfloraSession.apiFetch('/api/storefront/catalog');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        return data.products || [];
      },
    });
  },

  /**
   * Fetch Team Users for PIN login
   */
  async getTeamUsers() {
    return queryClient.fetchQuery({
      queryKey: QUERY_KEYS.teamUsers(),
      queryFn: async () => {
        const res = await window.ConfloraSession.apiFetch('/api/admin/auth/users');
        if (!res.ok) {
          return [];
        }
        const result = await res.json();
        return result?.order || result;
      },
    });
  },

  /**
   * Submit Checkout Order Mutation with automatic catalog cache invalidation
   */
  async submitOrder(orderPayload, api, idempotencyKey) {
    const headers = idempotencyKey
      ? { "Idempotency-Key": idempotencyKey }
      : {};
    return queryClient.mutate({
      mutationFn: async () => {
        if (typeof api === 'function') {
          const result = await api('/orders', {
            method: 'POST',
            body: orderPayload,
            headers,
          });
          return result?.order || result;
        }
        const res = await window.ConfloraSession.apiFetch('/api/storefront/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(orderPayload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.message || `HTTP ${res.status}`);
        }
        return await res.json();
      },
      onSuccess: () => {
        // Invalidate catalog to refresh stock levels
        queryClient.invalidateQueries({ queryKey: ['catalog'] });
      },
    });
  },

  /**
   * Quick Stock Entry Mutation
   */
  async adjustStock({ productId, quantityAdded }) {
    return queryClient.mutate({
      mutationFn: async () => {
        const res = await window.ConfloraSession.apiFetch('/api/stock/quick-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, quantityAdded: Number(quantityAdded) }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        return await res.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['catalog'] });
      },
    });
  },
};
