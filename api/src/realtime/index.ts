export {
  type AuthorizedEmitEntry,
  emitPayloadToAuthorizedRoom,
  emitSyncDeltaForChange,
  startChangeStreamWatcher,
  stopChangeStreamWatcher,
} from "./changeStreamWatcher";
export {matchesQuery} from "./queryMatcher";
export {
  addQuerySubscription,
  clearQueryStore,
  computeQueryId,
  getQuerySubscriptionsForCollection,
  removeAllSocketQueries,
  removeQuerySubscription,
} from "./queryStore";
export {
  installRealtimeSocketHandlers,
  MAX_DOCUMENT_SUBSCRIPTIONS,
  MAX_MODEL_SUBSCRIPTIONS,
  MAX_QUERY_SUBSCRIPTIONS,
  RealtimeApp,
  type RealtimeSocketLike,
} from "./realtimeApp";
export {
  clearRealtimeRegistry,
  findRegistryEntryByCollection,
  findRegistryEntryByRoutePath,
  getRealtimeRegistry,
  type RealtimeRegistryEntry,
  registerRealtime,
} from "./registry";
export {
  DEFAULT_SESSION_REVALIDATION_INTERVAL_MS,
  loadFullUserForSocket,
  type RevalidatableSocket,
  type RevalidationOutcome,
  reresolveSyncRoomsForSocket,
  revalidateSocketSession,
  runSessionRevalidationSweep,
  type SessionRevalidationHandle,
  type SessionRevalidationOptions,
  startSessionRevalidationSweep,
} from "./sessionRevalidation";
export {
  type AuthenticatableSocket,
  type BetterAuthSocketOptions,
  createBetterAuthValidator,
  createLegacyJwtValidator,
  createSocketAuthMiddleware,
  type SocketAuthValidator,
} from "./socketAuth";
export {
  type DecodedRealtimeToken,
  getSocketUser,
  type SocketDataBag,
  type SocketWithDecodedToken,
} from "./socketUser";
export type {
  ChangeStreamConfig,
  DocumentSubscription,
  QuerySubscription,
  RealtimeAppOptions,
  RealtimeConfig,
  RealtimeEvent,
} from "./types";
