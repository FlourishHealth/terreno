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
