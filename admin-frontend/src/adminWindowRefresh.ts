/**
 * Windowed admin writes go through the syncdb outbox instead of the REST list endpoint, so the
 * cached membership page never learns that a row was created or removed. Forms flag the
 * collection as stale after those writes and the changelist refetches membership, whether it
 * stayed mounted behind the form or remounts when the form pops.
 */
const staleCollections = new Set<string>();
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

export const isAdminWindowMembershipStale = (collection: string | undefined): boolean => {
  if (!collection) {
    return false;
  }
  return staleCollections.has(collection);
};

/** Signal that a windowed write changed which rows belong to `collection`. */
export const markAdminWindowMembershipStale = ({collection}: {collection: string}): void => {
  if (collection.length === 0 || staleCollections.has(collection)) {
    return;
  }
  staleCollections.add(collection);
  notify();
};

/** Called by the changelist once it has refetched membership for `collection`. */
export const clearAdminWindowMembershipStale = ({collection}: {collection: string}): void => {
  if (!staleCollections.delete(collection)) {
    return;
  }
  notify();
};

/** @internal Test helper — clears every stale flag. */
export const resetAdminWindowRefreshForTests = (): void => {
  staleCollections.clear();
  notify();
};
