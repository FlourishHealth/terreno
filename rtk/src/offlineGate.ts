import {resolveOfflineEndpoints} from "./offlineConfig";
import {
  type OfflineState,
  selectConnectionQuality,
  shouldDeferOfflineMutationForQuality,
} from "./offlineSlice";
import type {OfflineMiddlewareOfflineConfig, ResolvedOfflineEndpoint} from "./offlineTypes";

let offlineEndpointMap = new Map<string, ResolvedOfflineEndpoint>();
let offlineEnabled = false;

export const configureOfflineMiddleware = (config: OfflineMiddlewareOfflineConfig): void => {
  const resolved = resolveOfflineEndpoints(config);
  offlineEndpointMap = new Map(resolved.map((entry) => [entry.endpointName, entry]));
  offlineEnabled = "enabled" in config ? config.enabled : resolved.length > 0;
};

/** @deprecated Use configureOfflineMiddleware */
export const configureOfflineMutationEndpoints = (endpoints: string[]): void => {
  configureOfflineMiddleware({endpoints});
};

export const getConfiguredOfflineEndpoint = (
  endpointName: string
): ResolvedOfflineEndpoint | undefined => {
  return offlineEndpointMap.get(endpointName);
};

export const getConfiguredOfflineEndpoints = (): ResolvedOfflineEndpoint[] => {
  return [...offlineEndpointMap.values()];
};

export const isOfflineMiddlewareEnabled = (): boolean => {
  return offlineEnabled && offlineEndpointMap.size > 0;
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
  if (!offlineEnabled || !offlineEndpointMap.has(endpointName)) {
    return false;
  }

  const state = getState() as {offline: OfflineState};
  const quality = selectConnectionQuality(state);
  return shouldDeferOfflineMutationForQuality(quality);
};
