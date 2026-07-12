import {useSyncExternalStore} from "react";
import {getSyncDbReadySnapshot, subscribeSyncDbReady} from "@/store/syncdb";

/**
 * True once `syncDb.start()` (fired by the root layout after login) has resolved.
 * Screens that call `client.mutate()`/`useMutate()` should disable their
 * mutation-triggering controls while this is false — calling mutate() before start()
 * resolves throws "requires start() to have resolved an authenticated user".
 */
export const useSyncDbReady = (): boolean => {
  return useSyncExternalStore(subscribeSyncDbReady, getSyncDbReadySnapshot);
};
