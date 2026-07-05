/**
 * Transaction-based test isolation for MongoDB.
 *
 * Instead of clearing and reloading all collections before every test,
 * this module wraps each test in a MongoDB transaction that is aborted
 * after the test completes. This rolls back all changes made during the
 * test, leaving the database in its original state for the next test.
 *
 * How it works:
 * 1. Mongoose operations (Query.exec, Model.save, Aggregate.exec, etc.)
 *    are monkey-patched to inject the current test session when active.
 * 2. Before each test, a session is started and a transaction is begun.
 * 3. After each test, the transaction is aborted and the session is ended.
 * 4. All DB operations during the test see the pre-test snapshot and any
 *    writes made within the transaction, but nothing is persisted.
 *
 * Session reuse: a single MongoDB session is reused across all tests within
 * a worker to avoid transaction number mismatches caused by the MongoDB driver's
 * server session pool. When sessions are ended and reacquired from the pool,
 * in-flight operations from a previous test can arrive with a stale transaction
 * number, causing NoSuchTransaction errors. Reusing one session avoids this.
 *
 * Operation serialization: MongoDB does not support concurrent operations on
 * the same session within a transaction. When app code uses Promise.all() to
 * run DB operations in parallel, concurrent operations on the same session
 * cause TransientTransactionError / NoSuchTransaction. We solve this with a
 * reentrant async mutex:
 * - Top-level operations (the ones fired by Promise.all) are serialized
 * - Nested operations (e.g. pre-save hooks that do queries) detect they're
 *   already inside a serialized block and skip the mutex, preventing deadlocks
 * - AsyncLocalStorage tracks the serialization context across the async chain
 *
 * Limitations:
 * - App code that creates its own sessions (e.g. explicit transactions in
 *   route handlers) will have those sessions' operations redirected through
 *   the test session. The app's own commit/abort calls become no-ops.
 * - Native driver operations (mongoose.connection.db.collection(...)) are
 *   NOT patched. Only Mongoose-level operations are covered.
 */

import {AsyncLocalStorage} from "async_hooks";
import type {ClientSession} from "mongoose";
import mongoose from "mongoose";

let currentTestSession: ClientSession | null = null;
let patchesInstalled = false;

// ============================================================================
// Reentrant Async Mutex
// ============================================================================

/**
 * Tracks whether the current async context is already inside a serialized
 * DB operation. When true, nested operations skip the mutex to avoid deadlocks.
 */
const serializationContext = new AsyncLocalStorage<{active: boolean}>();

/**
 * Async mutex that serializes access to the MongoDB session.
 * Only one DB operation can be in-flight at a time when a test session is active.
 */
class AsyncMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }

  reset(): void {
    this.locked = false;
    this.queue = [];
  }
}

const sessionMutex = new AsyncMutex();

/**
 * Returns whether the active test transaction session can be attached to DB
 * operations on the given Mongoose connection. The Node driver's
 * `ClientSession` must belong to the same `MongoClient` as the collection;
 * otherwise operations throw `MongoInvalidArgumentError` (observed in CI when
 * mixing connections).
 *
 * @param connection - Mongoose connection (`Model.db`), or undefined when unknown
 * @returns True when the session should be passed into driver options / `.session()`
 */
const shouldAttachTestSessionToConnection = (
  connection: {getClient?: () => unknown} | null | undefined
): boolean => {
  if (!currentTestSession) {
    return false;
  }
  const sessionClient = (currentTestSession as {client?: unknown}).client;
  if (!connection || typeof connection.getClient !== "function") {
    return true;
  }
  const connClient = connection.getClient();
  if (!sessionClient || !connClient) {
    return true;
  }
  return sessionClient === connClient;
};

/**
 * Waits until all serialized DB operations have completed before test teardown.
 *
 * This prevents operations that were queued near test completion from leaking
 * into the next test's transaction window, which can surface as intermittent
 * NoSuchTransaction / transaction-number mismatch errors.
 */
const waitForSerializedOperationsToDrain = async (timeoutMs = 5000): Promise<void> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        await sessionMutex.acquire();
        sessionMutex.release();
      })(),
      new Promise<void>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(`[testTransaction] Timed out waiting for serialized operations to drain`)
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

/**
 * Wraps an async DB operation with the session mutex. Reentrant: if the current
 * async context is already inside a serialized block, the operation runs directly
 * without acquiring the mutex (preventing deadlocks from nested operations like
 * pre-save hooks that do queries).
 */
const serialized = <T>(fn: () => T | Promise<T>): T | Promise<T> => {
  // If no test session is active, skip serialization entirely
  if (!currentTestSession) {
    return fn();
  }

  // If we're already inside a serialized block (nested call), run directly
  const store = serializationContext.getStore();
  if (store?.active) {
    return fn();
  }

  // Top-level call: acquire mutex, then run inside the serialization context
  const run = async (): Promise<T> => {
    let hasRetried = false;

    while (true) {
      await sessionMutex.acquire();
      try {
        return await serializationContext.run({active: true}, fn);
      } catch (error: any) {
        // If this error aborted the transaction (e.g. E11000 duplicate key),
        // restart it and retry once so transient transaction-number mismatches
        // don't fail the test immediately.
        const isTransactionAborted =
          error?.errorLabels?.includes?.("TransientTransactionError") ||
          (currentTestSession && !currentTestSession.inTransaction());

        if (!hasRetried && isTransactionAborted && currentTestSession) {
          hasRetried = true;
          try {
            // Explicitly abort client-side transaction state before restart.
            if (currentTestSession.inTransaction()) {
              await currentTestSession.abortTransaction();
            }
            currentTestSession.startTransaction();
            continue;
          } catch {
            // Ignore — fallback to throwing original error below.
          }
        }

        throw error;
      } finally {
        sessionMutex.release();
      }
    }
  };
  return run();
};

// ============================================================================
// Public API
// ============================================================================

/** Returns the current test session, or null if not in a test transaction. */
export const getTestSession = (): ClientSession | null => currentTestSession;

/**
 * Starts a new test transaction. Call in beforeEach.
 *
 * Reuses the existing MongoDB session when possible. A new session is only
 * created on the very first call or after the previous session has been
 * explicitly ended (e.g., due to an error).
 */
export const startTestTransaction = async (): Promise<void> => {
  if (currentTestSession) {
    // Abort any leftover transaction from a previous test that wasn't cleaned up
    try {
      if (currentTestSession.inTransaction()) {
        await currentTestSession.abortTransaction();
      }
    } catch {
      // Session may be in a bad state — create a fresh one below
      try {
        await currentTestSession.endSession();
      } catch {
        // Ignore
      }
      currentTestSession = null;
    }
  }

  if (!currentTestSession) {
    currentTestSession = await mongoose.startSession();
  }

  sessionMutex.reset();
  currentTestSession.startTransaction();
};

/**
 * Aborts the current test transaction. Call in afterEach.
 *
 * The session is intentionally kept alive (not ended) so it can be reused by
 * the next test. This avoids returning the session to the driver's server
 * session pool, which prevents transaction number mismatches when in-flight
 * operations from a previous test complete after the session has been recycled.
 */
export const abortTestTransaction = async (): Promise<void> => {
  if (!currentTestSession) {
    return;
  }

  try {
    // Ensure any in-flight/queued DB work from the current test has settled
    // before aborting and starting the next transaction.
    await waitForSerializedOperationsToDrain();

    if (currentTestSession.inTransaction()) {
      await currentTestSession.abortTransaction();
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: test harness diagnostic when abort fails
    console.warn("[testTransaction] Error aborting transaction:", error);
    // If the abort failed, the session may be in a bad state. End it so
    // startTestTransaction creates a fresh one.
    try {
      await currentTestSession.endSession();
    } catch {
      // Ignore
    }
    currentTestSession = null;
  } finally {
    // Clean slate for the next test transaction.
    sessionMutex.reset();
  }
};

/**
 * Drops the cached test session after an out-of-band mongoose reconnect.
 *
 * Reconnects can swap the underlying MongoClient, which invalidates any active
 * ClientSession. Clearing here prevents subsequent tests from reusing a stale
 * or expired session.
 */
export const resetTestSessionAfterReconnect = async (): Promise<void> => {
  if (!currentTestSession) {
    sessionMutex.reset();
    return;
  }

  try {
    if (currentTestSession.inTransaction()) {
      await currentTestSession.abortTransaction();
    }
    await currentTestSession.endSession();
  } catch {
    // Ignore cleanup failures; session is being discarded regardless.
  } finally {
    currentTestSession = null;
    sessionMutex.reset();
  }
};

// ============================================================================
// Mongoose Monkey-Patches
// ============================================================================

/**
 * Installs Mongoose monkey-patches that inject the test session into all DB operations.
 *
 * Patches are idempotent — calling this multiple times is safe.
 * The patches only activate when currentTestSession is non-null (i.e., during a test).
 * All operations are serialized through the async mutex to prevent concurrent
 * operations on the same MongoDB session.
 *
 * Patched operations:
 * - Query.prototype.exec — covers find, findOne, updateOne, deleteMany, countDocuments, etc.
 * - Model.prototype.save and $save — covers save() and create() (Model.create calls $save)
 * - Aggregate.prototype.exec — covers aggregation pipelines
 * - Model.bulkWrite — covers bulk write operations
 * - Model.insertMany — covers bulk inserts (uses native driver, not save)
 * - Model.distinct — bypasses Query, calls native driver directly
 * - Model.startSession — returns a no-op wrapper so app-level transactions don't conflict
 * - Collection.prototype (insertOne, updateOne, deleteOne, etc.) — covers native driver
 *   operations used by tests that call Model.collection.insertOne() directly
 *
 * When a model or collection uses a different MongoClient than the one that
 * created the test session, patches skip session injection for that operation
 * so the driver does not reject mismatched clients.
 */
export const installTransactionPatches = (): void => {
  if (patchesInstalled) {
    return;
  }

  // --- Query.prototype.exec ---
  const originalQueryExec = mongoose.Query.prototype.exec;
  mongoose.Query.prototype.exec = function (this: any) {
    if (currentTestSession) {
      if (!shouldAttachTestSessionToConnection(this.model?.db)) {
        return originalQueryExec.apply(this);
      }
      this.session(currentTestSession);
      return serialized(() => originalQueryExec.apply(this));
    }
    return originalQueryExec.apply(this);
  } as any;

  // --- Model.prototype.save and $save ---
  // In Mongoose 8, Model.create() calls $save (not save). $save is assigned from
  // save at module load time (Model.prototype.$save = Model.prototype.save), so we
  // must patch both to ensure Model.create() goes through our session injection.
  const patchSave = (original: Function) =>
    function (this: any, options?: any) {
      if (currentTestSession) {
        const connection = this.constructor?.db;
        if (!shouldAttachTestSessionToConnection(connection)) {
          return original.call(this, options);
        }
        if (typeof options === "function") {
          this.$session(currentTestSession);
          return serialized(() => original.call(this, options));
        }
        options = {...(options || {}), session: currentTestSession};
        return serialized(() => original.call(this, options));
      }
      return original.call(this, options);
    };

  const originalSave = mongoose.Model.prototype.save;
  mongoose.Model.prototype.save = patchSave(originalSave) as any;

  // $save is what Model.create() actually calls
  const original$Save = mongoose.Model.prototype.$save;
  mongoose.Model.prototype.$save = patchSave(original$Save) as any;

  // --- Aggregate.prototype.exec ---
  const originalAggExec = mongoose.Aggregate.prototype.exec;
  mongoose.Aggregate.prototype.exec = function (this: any) {
    if (currentTestSession) {
      const connection = this._model?.db ?? this._connection;
      if (!shouldAttachTestSessionToConnection(connection)) {
        return originalAggExec.apply(this);
      }
      this.session(currentTestSession);
      return serialized(() => originalAggExec.apply(this));
    }
    return originalAggExec.apply(this);
  } as any;

  // --- Model.bulkWrite (static) ---
  const originalBulkWrite = mongoose.Model.bulkWrite;
  (mongoose.Model as any).bulkWrite = function (this: any, ops: any[], options?: any) {
    if (currentTestSession) {
      if (!shouldAttachTestSessionToConnection(this.db)) {
        return originalBulkWrite.call(this, ops, options);
      }
      options = {...(options || {}), session: currentTestSession};
      return serialized(() => originalBulkWrite.call(this, ops, options));
    }
    return originalBulkWrite.call(this, ops, options);
  };

  // --- Model.insertMany (static) ---
  const originalInsertMany = mongoose.Model.insertMany;
  (mongoose.Model as any).insertMany = function (this: any, docs: any, options?: any) {
    if (currentTestSession) {
      if (!shouldAttachTestSessionToConnection(this.db)) {
        return (originalInsertMany as any).call(this, docs, options);
      }
      options = {...(options || {}), session: currentTestSession};
      return serialized(() => (originalInsertMany as any).call(this, docs, options));
    }
    return (originalInsertMany as any).call(this, docs, options);
  };

  // --- Model.create (static) ---
  // Some code paths call Model.create() directly (including through
  // mongoose.Model.create.call(...)), which can otherwise bypass our top-level
  // serialization guard and race with other operations on the shared test
  // session. Wrapping create ensures transient transaction aborts trigger the
  // same auto-restart logic in serialized().
  const originalCreate = mongoose.Model.create;
  (mongoose.Model as any).create = function (this: any, ...args: any[]) {
    if (currentTestSession) {
      if (!shouldAttachTestSessionToConnection(this.db)) {
        return (originalCreate as any).apply(this, args);
      }
      return serialized(() => (originalCreate as any).apply(this, args));
    }
    return (originalCreate as any).apply(this, args);
  };

  // --- Model.startSession (static) ---
  // When test session is active, return a wrapper that redirects operations
  // through the test session. This ensures app code that creates its own
  // transactions (e.g. userExplorerAcquisitionUpload.ts) doesn't bypass
  // test isolation.
  const originalStartSession = mongoose.Model.startSession;
  (mongoose.Model as any).startSession = async function (this: any, options?: any) {
    if (currentTestSession) {
      return {
        ...currentTestSession,
        startTransaction: () => {},
        commitTransaction: async () => {},
        abortTransaction: async () => {},
        endSession: async () => {},
        id: currentTestSession.id,
        inTransaction: () => currentTestSession?.inTransaction() ?? false,
      };
    }
    return originalStartSession.call(this, options);
  };

  // --- Collection.prototype (native driver operations) ---
  // Some test files call Model.collection.insertOne() etc. directly, bypassing
  // Mongoose. We patch the Mongoose Collection wrapper to inject the session
  // into these operations so they participate in the test transaction.
  //
  // Methods are grouped by their options argument position:
  // - optionsAt1: (docOrFilter, options?) — insertOne, deleteOne, deleteMany, findOne, etc.
  // - optionsAt2: (filter, update, options?) — updateOne, updateMany, findOneAndUpdate, etc.
  const patchCollectionMethod = (method: string, optionsIndex: number): void => {
    const original = (mongoose.Collection.prototype as any)[method];
    if (typeof original !== "function") {
      return;
    }
    (mongoose.Collection.prototype as any)[method] = function (this: any, ...args: any[]) {
      if (!currentTestSession) {
        return original.apply(this, args);
      }
      if (!shouldAttachTestSessionToConnection(this.conn)) {
        return original.apply(this, args);
      }
      return serialized(() => {
        // Inject session into the options argument at the correct position
        if (args[optionsIndex] && typeof args[optionsIndex] === "object") {
          args[optionsIndex] = {...args[optionsIndex], session: currentTestSession};
        } else {
          args[optionsIndex] = {session: currentTestSession};
        }
        return original.apply(this, args);
      });
    };
  };

  // (docOrFilter, options?) — options at index 1
  for (const method of [
    "insertOne",
    "insertMany",
    "deleteOne",
    "deleteMany",
    "findOne",
    "findOneAndDelete",
    "countDocuments",
    "aggregate",
  ]) {
    patchCollectionMethod(method, 1);
  }

  // (filter, update/replacement, options?) — options at index 2
  for (const method of [
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "findOneAndReplace",
    "replaceOne",
  ]) {
    patchCollectionMethod(method, 2);
  }

  patchesInstalled = true;
  if (process.env.DEBUG_TEST_TRANSACTION === "true") {
    // biome-ignore lint/suspicious/noConsole: optional debug for patch installation
    console.debug("[testTransaction] Mongoose patches installed");
  }
};
