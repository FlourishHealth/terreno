/**
 * Minimal promisified IndexedDB key-value helpers shared by the encrypted web
 * persister, the key providers, and the wipe helper. Each operation opens the
 * database, runs a single transaction, and closes the connection so that
 * `deleteIdbDatabase` is never blocked by a lingering handle.
 */

const DEFAULT_OBJECT_STORE = "kv";

const getIndexedDb = (): IDBFactory => {
  const idb = globalThis.indexedDB;
  if (!idb) {
    throw new Error("IndexedDB is unavailable in this environment");
  }
  return idb;
};

const openKvDatabase = ({databaseName}: {databaseName: string}): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = getIndexedDb().open(databaseName, 1);
    request.onupgradeneeded = (): void => {
      if (!request.result.objectStoreNames.contains(DEFAULT_OBJECT_STORE)) {
        request.result.createObjectStore(DEFAULT_OBJECT_STORE);
      }
    };
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void =>
      reject(request.error ?? new Error(`Failed to open IndexedDB database "${databaseName}"`));
  });

const runTransaction = async <T>({
  databaseName,
  mode,
  operation,
}: {
  databaseName: string;
  mode: IDBTransactionMode;
  operation: (store: IDBObjectStore) => IDBRequest<T>;
}): Promise<T> => {
  const db = await openKvDatabase({databaseName});
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(DEFAULT_OBJECT_STORE, mode);
      const request = operation(transaction.objectStore(DEFAULT_OBJECT_STORE));
      const fail = (): void =>
        reject(transaction.error ?? new Error("IndexedDB transaction failed"));
      transaction.oncomplete = (): void => resolve(request.result);
      transaction.onabort = fail;
      transaction.onerror = fail;
    });
  } finally {
    db.close();
  }
};

/** Read a value; `undefined` when the key has never been written. */
export const idbGet = async <T>({
  databaseName,
  key,
}: {
  databaseName: string;
  key: string;
}): Promise<T | undefined> =>
  (await runTransaction<unknown>({
    databaseName,
    mode: "readonly",
    operation: (store) => store.get(key),
  })) as T | undefined;

/** Write a value (structured-cloneable, e.g. Uint8Array or CryptoKey). */
export const idbSet = async ({
  databaseName,
  key,
  value,
}: {
  databaseName: string;
  key: string;
  value: unknown;
}): Promise<void> => {
  await runTransaction({
    databaseName,
    mode: "readwrite",
    operation: (store) => store.put(value, key),
  });
};

/** Delete a single key (no-op when absent). */
export const idbDelete = async ({
  databaseName,
  key,
}: {
  databaseName: string;
  key: string;
}): Promise<void> => {
  await runTransaction({
    databaseName,
    mode: "readwrite",
    operation: (store) => store.delete(key),
  });
};

/** Delete an entire IndexedDB database (used by the wipe helper). */
export const deleteIdbDatabase = ({databaseName}: {databaseName: string}): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = getIndexedDb().deleteDatabase(databaseName);
    request.onsuccess = (): void => resolve();
    // Blocked means another open connection defers the deletion; it completes
    // once that connection closes, so treat it as success rather than hanging.
    request.onblocked = (): void => resolve();
    request.onerror = (): void =>
      reject(request.error ?? new Error(`Failed to delete IndexedDB database "${databaseName}"`));
  });
