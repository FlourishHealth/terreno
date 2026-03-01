import type {ModelRouterOptions} from "../api";
import type {RealtimeConfig} from "./types";

/**
 * A registered model with real-time sync configuration.
 */
export interface RealtimeRegistryEntry {
  /** Mongoose model name (e.g. "Todo") */
  modelName: string;
  /** Route path (e.g. "/todos") */
  routePath: string;
  /** Collection name in MongoDB (e.g. "todos") */
  collectionName: string;
  /** Real-time configuration from modelRouter options */
  config: RealtimeConfig;
  /** Full modelRouter options (for responseHandler, permissions, etc.) */
  options: ModelRouterOptions<any>;
}

const realtimeRegistry: RealtimeRegistryEntry[] = [];

/**
 * Register a model for real-time sync. Called automatically by modelRouter
 * when the `realtime` option is provided.
 */
export const registerRealtime = (entry: RealtimeRegistryEntry): void => {
  realtimeRegistry.push(entry);
};

/**
 * Get all registered real-time models.
 */
export const getRealtimeRegistry = (): RealtimeRegistryEntry[] => realtimeRegistry;

/**
 * Find a registry entry by MongoDB collection name.
 */
export const findRegistryEntryByCollection = (
  collectionName: string
): RealtimeRegistryEntry | undefined => {
  return realtimeRegistry.find((entry) => entry.collectionName === collectionName);
};

/**
 * Clear the registry (for testing).
 */
export const clearRealtimeRegistry = (): void => {
  realtimeRegistry.length = 0;
};
