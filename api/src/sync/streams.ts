import type {User} from "../auth";
import type {SyncRegistryEntry} from "./registry";
import type {SyncScope} from "./types";

/**
 * Stream key resolution for SyncDB.
 *
 * A stream is the unit of ordered delivery and cursor resumption:
 * `{collectionTag}|owner:{ownerId}`, `{collectionTag}|tenant:{tenantId}`,
 * `{collectionTag}|all` (broadcast), or `{collectionTag}|custom:{value}`.
 */

/** The document field a scope reads, or null for broadcast/custom scopes. */
export const getScopeField = (scope: SyncScope): string | null => {
  if (typeof scope === "function") {
    return null;
  }
  if (scope.type === "owner") {
    return scope.field ?? "ownerId";
  }
  if (scope.type === "tenant") {
    return scope.field;
  }
  return null;
};

/** Build a stream key from a collection tag and a raw scope value. */
export const streamForScopeValue = ({
  collectionTag,
  scope,
  scopeValue,
}: {
  collectionTag: string;
  scope: SyncScope;
  scopeValue: unknown;
}): string => {
  if (typeof scope === "function") {
    return `${collectionTag}|custom:${String(scopeValue)}`;
  }
  if (scope.type === "owner") {
    return `${collectionTag}|owner:${String(scopeValue)}`;
  }
  if (scope.type === "tenant") {
    return `${collectionTag}|tenant:${String(scopeValue)}`;
  }
  return `${collectionTag}|all`;
};

/**
 * Parse a stream key into its collection tag and scope value. The value is everything
 * after the first `:` following the `|`-delimited collection tag, so custom values
 * containing `:` survive intact. Broadcast streams (`{tag}|all`) yield `scopeValue: null`.
 * Returns null when the key is not a valid stream key.
 */
export const parseStreamKey = (
  stream: string
): {collectionTag: string; scopeKind: string; scopeValue: string | null} | null => {
  const pipe = stream.indexOf("|");
  if (pipe <= 0) {
    return null;
  }
  const collectionTag = stream.slice(0, pipe);
  const rest = stream.slice(pipe + 1);
  if (rest === "all") {
    return {collectionTag, scopeKind: "all", scopeValue: null};
  }
  const colon = rest.indexOf(":");
  if (colon < 0) {
    return null;
  }
  return {
    collectionTag,
    scopeKind: rest.slice(0, colon),
    scopeValue: rest.slice(colon + 1),
  };
};

/** Resolve the stream a document belongs to under the given scope. */
export const resolveStreamForDoc = ({
  collectionTag,
  scope,
  doc,
}: {
  collectionTag: string;
  scope: SyncScope;
  doc: Record<string, unknown>;
}): string => {
  if (typeof scope === "function") {
    return streamForScopeValue({collectionTag, scope, scopeValue: scope(doc)});
  }
  if (scope.type === "broadcast") {
    return streamForScopeValue({collectionTag, scope, scopeValue: null});
  }
  const field = getScopeField(scope) as string;
  return streamForScopeValue({collectionTag, scope, scopeValue: doc[field]});
};

/**
 * Resolve the streams a user currently belongs to for one registered entry — the
 * authoritative membership set, shared by the socket `sync:subscribe` handler,
 * `GET /sync/streams`, and the snapshot stream-membership check.
 *
 * - broadcast → the single `{collection}|all` stream.
 * - owner → the single stream keyed by the authenticated user's own id (a client-supplied
 *   id must never select the stream).
 * - tenant / custom → one stream per value from `getUserScopes`. Requires the resolver;
 *   throws {@link MissingScopeResolverError} when it is absent.
 *
 * Runs against the FULL user (D2) so tenant memberships resolve from current
 * `organizationIds`.
 */
export class MissingScopeResolverError extends Error {
  constructor(public collection: string) {
    super(`Sync collection ${collection} requires a getUserScopes resolver on SyncApp`);
    this.name = "MissingScopeResolverError";
  }
}

export const resolveUserStreamsForEntry = async ({
  entry,
  user,
  getUserScopes,
}: {
  entry: SyncRegistryEntry;
  user: User;
  getUserScopes?: (user: User, entry: SyncRegistryEntry) => Promise<string[]> | string[];
}): Promise<string[]> => {
  const {scope} = entry.config;
  const collection = entry.collectionTag;
  if (typeof scope !== "function" && scope.type === "broadcast") {
    return [streamForScopeValue({collectionTag: collection, scope, scopeValue: null})];
  }
  if (typeof scope !== "function" && scope.type === "owner") {
    return [streamForScopeValue({collectionTag: collection, scope, scopeValue: user.id})];
  }
  if (!getUserScopes) {
    throw new MissingScopeResolverError(collection);
  }
  const scopeValues = await getUserScopes(user, entry);
  return scopeValues.map((scopeValue) =>
    streamForScopeValue({collectionTag: collection, scope, scopeValue})
  );
};
