import type {Model} from "mongoose";
import type {ModelRouterOptions} from "../api";
import {logger} from "../logger";
import {getScopeField} from "./streams";
import type {SyncConfig} from "./types";

/**
 * A registered model with SyncDB local-first sync configuration.
 */
export interface SyncRegistryEntry {
  /** Mongoose model name (e.g. "Todo") */
  modelName: string;
  /** Route path (e.g. "/todos") */
  routePath: string;
  /** Collection tag used in the sync protocol (route path without the leading slash) */
  collectionTag: string;
  /** MongoDB collection name (e.g. "todos") */
  collectionName: string;
  /** Sync configuration from modelRouter options */
  config: SyncConfig;
  /** Full modelRouter options (for responseHandler, permissions, etc.) */
  options: ModelRouterOptions<unknown>;
}

const syncRegistry: SyncRegistryEntry[] = [];

/**
 * C8: index creation is kicked off (fire-and-forget) at registration, but its failure must
 * be a STARTUP error, not a swallowed warning (a missing index table-scans the snapshot
 * query under load, and a missing unique index breaks mutation idempotency). Each
 * registration records its index promise here; `ensureSyncIndexes()` awaits them and
 * throws on any failure so server startup can fail loudly. A detached failure is also
 * logged so it is never silent even if startup never calls `ensureSyncIndexes`.
 */
const indexCreationPromises: Promise<void>[] = [];

/**
 * Enqueue an index-creation promise for `ensureSyncIndexes()` to await at startup. Used by
 * `SyncApp.register` for the bookkeeping-model indexes (`SyncCounter`, `SyncMutation`,
 * `SyncScopeMove`, `SyncKey`), which are correctness-critical and must not depend on
 * Mongoose `autoIndex` being enabled.
 */
export const trackSyncIndexCreation = (promise: Promise<void>): void => {
  indexCreationPromises.push(promise);
  // Swallow the detached rejection (the failure is logged where it happens and rethrown
  // by `ensureSyncIndexes()` via the retained promise above).
  promise.catch(() => {});
};

/**
 * Register a model for local-first sync. Called automatically by modelRouter when the
 * `sync` option is provided. Validates the schema contract at startup and throws with
 * an actionable message when it is not met:
 * - soft delete (`isDeletedPlugin`) is required so deletes remain queryable tombstones;
 * - `syncPlugin` is required so every write stamps a per-stream `_syncSeq`;
 * - owner/tenant scope fields must exist on the schema.
 */
export const registerSync = ({
  model,
  routePath,
  config,
  options,
}: {
  model: Model<unknown>;
  routePath: string;
  config: SyncConfig;
  options: ModelRouterOptions<unknown>;
}): void => {
  const name = model.modelName;
  const deletedPath = model.schema.path("deleted");
  if (deletedPath?.instance !== "Boolean") {
    throw new Error(
      `Model ${name} has a sync config but no soft delete support. ` +
        "Apply isDeletedPlugin to the schema — sync catch-up requires delete tombstones."
    );
  }
  if (!model.schema.path("_syncSeq")) {
    throw new Error(
      `Model ${name} has a sync config but syncPlugin is not applied to its schema. ` +
        "Apply syncPlugin so every write stamps a per-stream _syncSeq."
    );
  }
  const scopeField = getScopeField(config.scope);
  if (scopeField && !model.schema.path(scopeField)) {
    throw new Error(
      `Model ${name} has a sync scope on field "${scopeField}" but the schema has no such path.`
    );
  }
  if (typeof config.scope === "function" && !config.snapshotFilter) {
    throw new Error(
      `Model ${name} uses a custom sync scope resolver, which requires a snapshotFilter ` +
        "so the snapshot endpoint can restrict queries to the caller's documents."
    );
  }
  if (syncRegistry.some((entry) => entry.modelName === name)) {
    throw new Error(`Model ${name} is already registered for sync.`);
  }
  // C8: a duplicate collectionTag would make two models share sync streams and route
  // snapshots/deltas ambiguously — reject it loudly at registration.
  const collectionTag = routePath.replace(/^\//, "");
  if (syncRegistry.some((entry) => entry.collectionTag === collectionTag)) {
    throw new Error(
      `Sync collection tag "${collectionTag}" is already registered (routePath ${routePath}). ` +
        "Each synced model must have a unique route path."
    );
  }

  syncRegistry.push({
    collectionName: model.collection.collectionName,
    collectionTag,
    config,
    modelName: name,
    options,
    routePath,
  });

  // `Model.bulkWrite` bypasses Mongoose middleware entirely, so `syncPlugin`'s query
  // guards never see it: writes land with no `_syncSeq`, invisible to both delta emission
  // and snapshot catch-up, and clients silently never learn about them. The restriction
  // used to be documentation only — replace the static so it throws the same way the
  // guarded multi-document paths do. Idempotent: the replacement never delegates, so a
  // re-registration (tests clearing the registry) re-patching it is harmless.
  (model as unknown as {bulkWrite: () => never}).bulkWrite = (): never => {
    throw new Error(
      `bulkWrite is not supported on sync-enabled model ${name}: it bypasses Mongoose ` +
        "middleware, so writes are never stamped with a per-stream _syncSeq and become " +
        "invisible to sync delta emission and snapshot catch-up. Loop per document instead."
    );
  };

  // Compound index for snapshot/catch-up queries: {scopeField, _syncSeq}. Created
  // directly on the collection because the model is already compiled at registration.
  // C8: track the promise so `ensureSyncIndexes()` (server startup) can fail loudly on a
  // createIndex error — a missing index table-scans the snapshot query under load. The
  // detached path only logs (never throws into an orphaned promise).
  const indexSpec: Record<string, 1> = scopeField ? {[scopeField]: 1, _syncSeq: 1} : {_syncSeq: 1};
  const indexPromise = model.collection
    .createIndex(indexSpec)
    .then(() => {})
    .catch((error: unknown) => {
      logger.error(`[sync] Failed to create sync index for ${name}`, {error: String(error)});
      throw new Error(
        `Failed to create sync snapshot index for ${name}: ${String(error)}. ` +
          "The snapshot/catch-up query requires this index; fix the schema/DB and restart."
      );
    });
  indexCreationPromises.push(indexPromise);
  // Swallow the detached rejection (already logged) so it is not an unhandled rejection;
  // `ensureSyncIndexes()` still observes it via the retained promise above.
  indexPromise.catch(() => {});
};

/**
 * C8: await every enqueued sync index creation — per-model snapshot indexes from
 * `registerSync` plus the bookkeeping-model indexes from `SyncApp.register` — throwing on
 * the first failure. Called at server startup by `TerrenoApp.start()` (after all models
 * and plugins register) so a missing index fails the boot loudly rather than silently
 * degrading the snapshot query to a table scan or breaking mutation idempotency.
 */
export const ensureSyncIndexes = async (): Promise<void> => {
  await Promise.all(indexCreationPromises);
};

/** Get all registered sync models. */
export const getSyncRegistry = (): SyncRegistryEntry[] => syncRegistry;

/**
 * Collection tags whose scope can only be resolved from the FULL user document —
 * tenant scopes read `organizationIds` (or whatever `getUserScopes` looks at) and custom
 * resolvers may read anything. The synthetic `{_id, admin, id}` user built from JWT claims
 * carries none of that.
 */
const scopesRequiringFullUser = (): string[] =>
  syncRegistry
    .filter(
      (entry) => typeof entry.config.scope === "function" || entry.config.scope.type === "tenant"
    )
    .map((entry) => entry.collectionTag);

/**
 * Task 9.21: warn loudly at startup when a tenant/custom-scoped collection is registered
 * but no `userModel` is configured for socket handshakes.
 *
 * Without one, `getSocketUser` falls back to the synthetic decoded-token user: `admin`
 * comes from a JWT claim rather than the database, and `getUserScopes` sees no
 * `organizationIds`, so tenant subscriptions silently resolve to no streams (a client that
 * appears connected but never receives data). This warns rather than throws so an existing
 * deployment cannot be bricked by an upgrade; the message names the collections and the
 * fix. Returns the offending collection tags for tests and callers that want to escalate.
 */
export const warnOnSyncScopesWithoutUserModel = ({userModel}: {userModel?: unknown}): string[] => {
  if (userModel) {
    return [];
  }
  const collections = scopesRequiringFullUser();
  if (collections.length === 0) {
    return [];
  }
  logger.error(
    "[sync] Tenant/custom-scoped sync collections are registered but RealtimeApp has no " +
      "userModel: socket authorization will fall back to the synthetic JWT-claim user, which " +
      "carries no membership fields, so tenant streams resolve to nothing and `admin` is " +
      "trusted from the token instead of the database. Pass `userModel` in RealtimeAppOptions " +
      "(TerrenoApp does this automatically for its own userModel).",
    {collections}
  );
  return collections;
};

/** Find a sync registry entry by Mongoose model name. */
export const findSyncEntryByModelName = (modelName: string): SyncRegistryEntry | undefined =>
  syncRegistry.find((entry) => entry.modelName === modelName);

/** Find a sync registry entry by collection tag (e.g. "todos"). */
export const findSyncEntryByCollectionTag = (
  collectionTag: string
): SyncRegistryEntry | undefined =>
  syncRegistry.find((entry) => entry.collectionTag === collectionTag);

/** Find a sync registry entry by MongoDB collection name. */
export const findSyncEntryByCollectionName = (
  collectionName: string
): SyncRegistryEntry | undefined =>
  syncRegistry.find((entry) => entry.collectionName === collectionName);

/** Clear the registry (for testing). */
export const clearSyncRegistry = (): void => {
  syncRegistry.length = 0;
  indexCreationPromises.length = 0;
};
