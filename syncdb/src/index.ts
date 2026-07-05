/**
 * @terreno/syncdb — local-first data layer for Terreno apps.
 *
 * The on-device store (TinyBase MergeableStore) is the UI's source of truth:
 * reads come from the local store, writes apply optimistically to local state and a
 * durable outbox, and the server is asynchronous reconciliation over a websocket
 * delta protocol with HTTP snapshot catch-up. Supersedes @terreno/rtk for
 * data-synchronization concerns. See docs/implementationPlans/syncdb-local-first.md.
 */

// React bindings intentionally live on the `@terreno/syncdb/react` subpath
// (src/react/index.ts) rather than here: react is an optional peer dependency
// and the main entry must stay importable without it.
export * from "./auth/betterAuthAdapter";
export * from "./auth/types";
export * from "./client";
export * from "./crypto/aesGcmCodec";
export * from "./crypto/identityCodec";
export * from "./crypto/keyProviders";
export * from "./crypto/types";
export * from "./mutations/conflicts";
export * from "./mutations/outbox";
export * from "./mutations/resolveConflict";
export * from "./persisters/defaultPersisterFactory";
export * from "./persisters/encryptedIndexedDbPersister";
export * from "./persisters/memoryPersister";
export * from "./persisters/types";
export * from "./storage/idb";
export * from "./storage/schema";
export * from "./storage/store";
export * from "./storage/types";
export * from "./storage/wipe";
export * from "./sync/bootstrap";
export * from "./sync/cursor";
export * from "./sync/deltaApplier";
export * from "./sync/fakeTransport";
export * from "./sync/httpChannel";
export * from "./sync/replayCoordinator";
export * from "./sync/socketTransport";
export * from "./sync/transport";
export * from "./types";
