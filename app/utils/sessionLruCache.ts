/**
 * Tiny in-memory LRU map for single-page session caches.
 * Not shared across tabs or reloads — lives only as long as the holder does.
 */
export default function createSessionLruCache<T>(maxEntries: number) {
  const store = new Map<string, T>();

  const get = (key: string): T | undefined => {
    if (!store.has(key)) return undefined;
    const value = store.get(key) as T;
    // Refresh recency without changing value identity.
    store.delete(key);
    store.set(key, value);
    return value;
  };

  const set = (key: string, value: T) => {
    if (store.has(key)) {
      store.delete(key);
    }
    store.set(key, value);

    while (store.size > maxEntries) {
      const oldest = store.keys().next().value;
      if (oldest === undefined) break;
      store.delete(oldest);
    }
  };

  const has = (key: string) => store.has(key);

  const deleteKey = (key: string) => {
    store.delete(key);
  };

  const clear = () => {
    store.clear();
  };

  return {
    get,
    set,
    has,
    delete: deleteKey,
    clear,
    get size() {
      return store.size;
    },
  };
}

export type SessionLruCache<T> = ReturnType<typeof createSessionLruCache<T>>;
