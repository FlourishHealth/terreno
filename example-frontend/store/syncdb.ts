/**
 * @terreno/syncdb client for the example app.
 *
 * The example app authenticates with the JWT auth slice from @terreno/rtk (not Better
 * Auth), so the AuthProvider is implemented against what the app actually uses:
 * - getToken: the stored JWT from @terreno/rtk's token storage
 * - getUserId: the auth slice's userId in the Redux store
 * - onAuthChange: a Redux store subscription that fires when userId changes
 */
import {baseUrl, getAuthToken} from "@terreno/rtk";
import {type AuthProvider, createSyncDb, type SyncDb} from "@terreno/syncdb";
import store from "@/store";

/** Persisted database name; also used by the dev panel's wipe action. */
export const SYNC_DB_NAME = "terreno-example";

/** Collections synced locally. The Todos screen reads/writes this collection. */
export const SYNC_COLLECTIONS = ["todos"];

const selectUserId = (): string | null => {
  // auth can be momentarily undefined while redux-persist rehydrates.
  return store.getState().auth?.userId ?? null;
};

const authProvider: AuthProvider = {
  getToken: async () => {
    return (await getAuthToken()) ?? null;
  },
  getUserId: async () => {
    return selectUserId();
  },
  onAuthChange: (callback) => {
    let lastUserId = selectUserId();
    return store.subscribe(() => {
      const userId = selectUserId();
      if (userId === lastUserId) {
        return;
      }
      lastUserId = userId;
      callback();
    });
  },
};

/**
 * Singleton local-first client. Started/stopped by the root layout when the USE_SYNCDB
 * flag is on and the user is authenticated; wipe-on-user-change is handled internally.
 */
export const syncDb: SyncDb = createSyncDb({
  authProvider,
  baseUrl,
  collections: SYNC_COLLECTIONS,
  name: SYNC_DB_NAME,
});
