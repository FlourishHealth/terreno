/**
 * Windowed admin writes go through the syncdb outbox instead of the REST list endpoint, so the
 * cached membership page never learns that a row was created or removed. Forms flag the
 * collection here and the changelist refetches membership, whether it stayed mounted behind the
 * form or remounts when the form pops.
 *
 * A create also has to outrun the outbox: `mutate` only enqueues, so the first refetch can land
 * before the server has the row. `awaitId` tells the changelist which id to wait for, and it
 * retries a bounded number of times before falling back to the manual Refresh control.
 */
export interface AdminWindowMembershipStale {
  /** Id a create is waiting on; absent for deletes, where any refetch is authoritative. */
  awaitId?: string;
}

const staleByCollection = new Map<string, AdminWindowMembershipStale>();
const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

export const subscribeAdminWindowRefresh = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
  };
};

/**
 * Returns a stable entry reference while the flag is unchanged, so it can back
 * `useSyncExternalStore` without re-rendering on every notification.
 */
export const getAdminWindowMembershipStale = (
  collection: string | undefined
): AdminWindowMembershipStale | undefined => {
  if (!collection) {
    return undefined;
  }
  return staleByCollection.get(collection);
};

/** Signal that a windowed write changed which rows belong to `collection`. */
export const markAdminWindowMembershipStale = ({
  collection,
  awaitId,
}: {
  collection: string;
  awaitId?: string;
}): void => {
  if (collection.length === 0) {
    return;
  }
  const existing = staleByCollection.get(collection);
  if (existing && existing.awaitId === awaitId) {
    return;
  }
  staleByCollection.set(collection, awaitId ? {awaitId} : {});
  notify();
};

/** Called by the changelist once it has taken ownership of the refetch for `collection`. */
export const clearAdminWindowMembershipStale = ({collection}: {collection: string}): void => {
  if (!staleByCollection.delete(collection)) {
    return;
  }
  notify();
};

/** @internal Test helper — clears every stale flag. */
export const resetAdminWindowRefreshForTests = (): void => {
  staleByCollection.clear();
  notify();
};
