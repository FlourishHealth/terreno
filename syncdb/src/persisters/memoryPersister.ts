import type {MergeableContent, MergeableStore} from "tinybase";
import {createCustomPersister, type Persister, Persists} from "tinybase/persisters";

import type {PersisterFactory} from "./types";

/**
 * Module-level backing keyed by databaseName. Two persisters created with the
 * same databaseName (even against different stores) share persisted state,
 * which is how tests and SSR emulate cross-session persistence. Content is
 * stored as a JSON string so loads get a fresh deep copy, never a live
 * reference into another store.
 */
const memoryBacking = new Map<string, string>();

/**
 * In-memory persister for tests and SSR/no-storage fallbacks. Persists the
 * full mergeable (CRDT) content so reloading into a fresh store retains
 * hybrid-logical-clock metadata, mirroring real persister behavior.
 */
export const createMemoryPersister = ({
  store,
  databaseName,
}: {
  store: MergeableStore;
  databaseName: string;
}): Persister<Persists.MergeableStoreOnly> =>
  createCustomPersister<number, Persists.MergeableStoreOnly>(
    store,
    async (): Promise<MergeableContent | undefined> => {
      const json = memoryBacking.get(databaseName);
      return json === undefined ? undefined : (JSON.parse(json) as MergeableContent);
    },
    async (getContent): Promise<void> => {
      memoryBacking.set(databaseName, JSON.stringify(getContent()));
    },
    // The backing map never changes underneath the persister, so there is no
    // external change source to listen to; a token handle keeps the
    // add/del listener lifecycle symmetric.
    (): number => 1,
    (_listenerHandle: number): void => {},
    undefined,
    Persists.MergeableStoreOnly
  );

/** PersisterFactory adapter for {@link createMemoryPersister}. */
export const memoryPersisterFactory: PersisterFactory = ({store, databaseName}) =>
  createMemoryPersister({databaseName, store});

/** Drop the in-memory persisted content for one databaseName (wipe/tests). */
export const clearMemoryPersisterData = ({databaseName}: {databaseName: string}): void => {
  memoryBacking.delete(databaseName);
};
