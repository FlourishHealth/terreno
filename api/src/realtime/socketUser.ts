import type {User} from "../auth";

export interface DecodedRealtimeToken {
  admin?: boolean;
  id?: string;
  isAnonymous?: boolean;
  /** JWT `exp` claim (seconds since epoch) — present for the legacy JWT validator only. */
  exp?: number;
  /** JWT `iss` claim — present for the legacy JWT validator only. */
  iss?: string;
  /**
   * Which validator in the chain authenticated this socket (D1: the periodic
   * re-validation sweep uses this to pick the matching cheap re-check — local JWT
   * expiry verification vs. a Better Auth session lookup). Undefined for handshakes
   * that predate this field (never actually observable at runtime — set by every
   * validator — but kept optional so structural test doubles compile without it).
   */
  authKind?: "jwt" | "better-auth";
}

/**
 * Per-socket data bag. `fullUser` is populated once at handshake (see
 * `loadFullUserForSocket` / `RealtimeApp`'s connection handler) by loading the full
 * Mongoose user document for `decodedToken.id`, and refreshed by D1's periodic
 * re-validation sweep. When present it is authoritative for authorization (permits
 * fields like `organizationIds` that the synthetic decoded-token shape never carries
 * — see D2); the synthetic shape remains a fallback for setups with no `userModel`
 * configured, or while the handshake load is still in flight.
 */
export interface SocketDataBag {
  /**
   * The consumer's own Mongoose user document, so its app-specific fields are opaque
   * here — read it through {@link getSocketUser} rather than narrowing it inline.
   */
  fullUser?: unknown;
  /**
   * The in-flight handshake load of {@link SocketDataBag.fullUser}, published so handlers
   * that must not authorize against the synthetic token user can await it
   * (see {@link awaitSocketFullUser}). Never rejects.
   */
  fullUserLoad?: Promise<void>;
  /**
   * Sync collection tag -> joined `sync:{stream}` rooms (see `socketHandlers.ts`).
   * Lives on the data bag (not the handler closure) so D1's sweep can re-resolve
   * stream membership and `socket.leave()` rooms no longer held (D4) without needing
   * access to `installSyncSocketHandlers`'s internal state.
   */
  syncSubscriptions?: Map<string, Set<string>>;
}

export interface SocketWithDecodedToken {
  decodedToken?: DecodedRealtimeToken;
  data?: SocketDataBag;
}

/**
 * Resolve the authorization-ready user for a socket: the full user document loaded at
 * handshake (`socket.data.fullUser`, see D2) when available, otherwise the synthetic
 * `{_id, admin, id, isAnonymous}` shape derived from the decoded token alone. Consumers
 * (permission checks, `getUserScopes`, delta filters) should always go through this
 * function rather than reading `decodedToken` directly, so they transparently benefit
 * once a `userModel` is configured.
 */
export const getSocketUser = (socket: SocketWithDecodedToken): User | undefined => {
  const fullUser = socket.data?.fullUser as User | undefined;
  if (fullUser) {
    return fullUser;
  }

  const userId = socket.decodedToken?.id;
  if (!userId) {
    return undefined;
  }

  return {
    _id: userId,
    admin: socket.decodedToken?.admin === true,
    id: userId,
    isAnonymous: socket.decodedToken?.isAnonymous,
  };
};

/**
 * Task 9.21: {@link getSocketUser}, but first awaiting the handshake full-user load when it
 * is still in flight. Sync handlers use this so a `sync:subscribe` / `sync:mutate` that
 * lands inside the handshake window is authorized against the same user every later event
 * sees — scope membership must not depend on event timing. Falls back to the synthetic
 * token user exactly as `getSocketUser` does when no `userModel` is configured.
 */
export const awaitSocketFullUser = async (
  socket: SocketWithDecodedToken
): Promise<User | undefined> => {
  // The load swallows and logs its own failures; this await only orders the events.
  await socket.data?.fullUserLoad;
  return getSocketUser(socket);
};
