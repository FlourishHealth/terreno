import {logger} from "../logger";

/**
 * One-line warning for modelRouter `realtime`. Keep in sync with the
 * `@terreno/rtk` helpers and `docs/implementationPlans/remove-legacy-realtime.md`.
 */
export const REALTIME_DEPRECATION_MESSAGE =
  "modelRouter `realtime` is deprecated and will be removed in Terreno 58. Use `sync` with `@terreno/syncdb` instead. See docs/how-to/migrate-rtk-to-syncdb.md. RealtimeApp remains required for sync sockets.";

const warnedKeys = new Set<string>();

const warningKey = (modelName: string, routePath?: string): string =>
  `${modelName}:${routePath ?? ""}`;

/**
 * Emits a one-time deprecation warning per model/routePath per process when a
 * consumer enables the legacy RTK cache-patching `realtime` option.
 */
export const warnRealtimeDeprecated = (modelName: string, routePath?: string): void => {
  const key = warningKey(modelName, routePath);
  if (warnedKeys.has(key)) {
    return;
  }
  warnedKeys.add(key);
  const location = routePath ? `${modelName} at ${routePath}` : modelName;
  logger.warn(`[realtime] ${REALTIME_DEPRECATION_MESSAGE} (${location})`);
};

/** @internal Test helper — clears one-time realtime deprecation warnings. */
export const resetRealtimeDeprecationWarningsForTests = (): void => {
  warnedKeys.clear();
};
