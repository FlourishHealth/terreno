import {type OfflineState, selectIsOnline} from "./offlineSlice";

let offlineMutationEndpoints = new Set<string>();

/** Register mutation endpoints that should be queued instead of sent while offline. */
export const configureOfflineMutationEndpoints = (endpoints: string[]): void => {
  offlineMutationEndpoints = new Set(endpoints);
};

/**
 * When true, the base query should return a network error without making a request.
 * The offline middleware will queue the mutation and apply an optimistic update.
 */
export const shouldDeferOfflineMutation = (
  endpointName: string,
  // biome-ignore lint/suspicious/noExplicitAny: Redux getState is app-specific
  getState: () => any
): boolean => {
  if (!offlineMutationEndpoints.has(endpointName)) {
    return false;
  }

  const state = getState() as {offline: OfflineState};
  return !selectIsOnline(state);
};
