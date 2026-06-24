const DB_NAME = "jianghu-dm-storage-v1";
const STORE_NAME = "kv";
const keyOperationQueue = new Map<string, Promise<void>>();

function hasIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

export function supportsPersistentIndexedDb() {
  return hasIndexedDb();
}

function fallbackRead<T>(key: string) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function fallbackWrite<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

function fallbackDelete(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    return;
  }
}

function consumeQueuedError() {
  return undefined;
}

function enqueueKeyOperation(key: string, operation: () => Promise<void>) {
  const previous = keyOperationQueue.get(key) || Promise.resolve();
  const next = previous
    .catch(consumeQueuedError)
    .then(operation);

  keyOperationQueue.set(key, next);

  return next.finally(() => {
    if (keyOperationQueue.get(key) === next) {
      keyOperationQueue.delete(key);
    }
  });
}

async function waitForPendingKeyOperation(key: string) {
  const pending = keyOperationQueue.get(key);
  if (!pending) return;
  await pending.catch(consumeQueuedError);
}

function openPersistentDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB."));
  });
}

export async function readPersistentValue<T>(key: string): Promise<T | undefined> {
  if (!hasIndexedDb()) return fallbackRead<T>(key);

  try {
    await waitForPendingKeyOperation(key);
    const db = await openPersistentDb();
    return await new Promise<T | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      transaction.oncomplete = () => db.close();
      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error(`Failed to read ${key}.`));
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error || new Error(`Reading ${key} was aborted.`));
      };
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error || new Error(`Failed to read ${key}.`));
    });
  } catch {
    return fallbackRead<T>(key);
  }
}

export async function writePersistentValue<T>(key: string, value: T): Promise<void> {
  if (!hasIndexedDb()) {
    fallbackWrite(key, value);
    return;
  }

  try {
    await enqueueKeyOperation(key, async () => {
      const db = await openPersistentDb();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error || new Error(`Failed to write ${key}.`));
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error || new Error(`Writing ${key} was aborted.`));
        };
        request.onerror = () => reject(request.error || new Error(`Failed to write ${key}.`));
      });
    });
  } catch {
    fallbackWrite(key, value);
  }
}

export async function deletePersistentValue(key: string): Promise<void> {
  if (!hasIndexedDb()) {
    fallbackDelete(key);
    return;
  }

  try {
    await enqueueKeyOperation(key, async () => {
      const db = await openPersistentDb();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error || new Error(`Failed to delete ${key}.`));
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error || new Error(`Deleting ${key} was aborted.`));
        };
        request.onerror = () => reject(request.error || new Error(`Failed to delete ${key}.`));
      });
    });
  } catch {
    fallbackDelete(key);
  }
}
