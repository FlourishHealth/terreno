/**
 * Runtime configuration registry with a fixed resolution order:
 *
 *   1. In-process override (Config.setOverride) — highest, for tests/bootstrap
 *   2. Cached env map — typically loaded from an admin-editable Mongoose document
 *   3. process.env
 *   4. Registered default
 *
 * Why a registry: every key migrating off raw `process.env` declares its type
 * and default in one place. That keeps the admin UI honest (no surprise keys),
 * gives synchronous access without scattered `?? "default"` literals at call
 * sites, and lets tests assert behavior against a single source of truth.
 *
 * Why sync: hundreds of call sites read configuration during request handling
 * and module init; an async API would force enormous refactors. Callers load
 * the env map once via `Config.refresh()` after Mongo connects, then read
 * synchronously from cache.
 *
 * The mechanism is agnostic to where the env map comes from. Apps wire up
 * their backing store with `Config.setEnvLoader(fn)`. The optional
 * `envConfigurationPlugin` provides a drop-in Mongoose schema integration.
 */

import {APIError} from "./errors";

const overrides = new Map<string, string | undefined>();

let cachedEnv: Record<string, string> | null = null;

let envLoader: (() => Promise<Record<string, string>>) | null = null;

export interface ConfigRegistration {
  /** Default returned when neither override, cache, nor process.env supplies a value. */
  default?: string;
  /** Documentation surfaced in the admin UI. */
  description?: string;
  /** Marks the key as a secret so admin UI can mask the value. */
  secret?: boolean;
}

// Null-prototype object so lookups don't resolve inherited keys like
// `constructor` / `toString` as accidentally-registered entries.
const REGISTRY: Record<string, ConfigRegistration> = Object.create(null);

/**
 * Registers a configuration key, its default, and metadata. Re-registration
 * of the same key throws so duplicates surface at boot.
 */
const register = (key: string, registration: ConfigRegistration = {}): void => {
  if (REGISTRY[key]) {
    throw new APIError({status: 500, title: `Config key "${key}" registered more than once`});
  }
  REGISTRY[key] = registration;
};

/**
 * Returns the configured string value for `key`, applying the resolution
 * order documented at the top of this file. Returns `undefined` if no
 * source supplies a value and no default was registered.
 */
const getString = (key: string): string | undefined => {
  if (overrides.has(key)) {
    return overrides.get(key);
  }
  if (cachedEnv && key in cachedEnv) {
    const v = cachedEnv[key];
    if (v !== undefined && v !== "") {
      return v;
    }
  }
  // Guard against process.env keys like "toString" / "constructor" inheriting
  // a function from Object.prototype. Only accept string values.
  const fromProcess = process.env[key];
  if (typeof fromProcess === "string" && fromProcess !== "") {
    return fromProcess;
  }
  return REGISTRY[key]?.default;
};

/**
 * Returns the configured value as a number. Throws if a value is present but
 * not finite — silent NaN propagation has bitten apps before.
 */
const getNumber = (key: string): number | undefined => {
  const raw = getString(key);
  if (raw === undefined) {
    return undefined;
  }
  // Number() rejects partially-numeric strings like "5000ms" (returns NaN)
  // whereas parseFloat would silently truncate to 5000.
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new APIError({
      status: 500,
      title: `Config key "${key}" is not a valid number: ${JSON.stringify(raw)}`,
    });
  }
  return parsed;
};

/**
 * Returns true iff the string value equals "true" (case-insensitive). Mirrors
 * the existing `process.env.X === "true"` idiom.
 */
const getBoolean = (key: string): boolean => {
  const raw = getString(key);
  return raw !== undefined && raw.toLowerCase() === "true";
};

/**
 * Parses a JSON-encoded config value. Returns undefined if unset; throws on
 * malformed JSON so misconfiguration fails loud at the call site rather than
 * producing silent runtime errors later.
 */
const getJSON = <T = unknown>(key: string): T | undefined => {
  const raw = getString(key);
  if (raw === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new APIError({
      status: 500,
      title: `Config key "${key}" is not valid JSON: ${(error as Error).message}`,
    });
  }
};

/**
 * Registers a loader that returns the env map (typically backed by an
 * admin-editable Mongoose document). Called once at app startup before
 * the first `Config.refresh()`.
 */
const setEnvLoader = (loader: (() => Promise<Record<string, string>>) | null): void => {
  envLoader = loader;
};

/**
 * Reloads the in-memory cache by invoking the registered env loader. No-op
 * (clears cache) if no loader has been registered.
 */
const refresh = async (): Promise<void> => {
  if (!envLoader) {
    cachedEnv = {};
    return;
  }
  cachedEnv = await envLoader();
};

/** Replaces the cache directly. Intended for the envConfigurationPlugin and tests. */
const setCachedEnv = (env: Record<string, string> | null): void => {
  cachedEnv = env;
};

/**
 * Sets an in-process override for `key`. Highest precedence — wins over
 * the cached env map. Intended for tests and bootstrap helpers.
 */
const setOverride = (key: string, value: string | undefined): void => {
  overrides.set(key, value);
};

/** Clears every override. Call from afterEach in tests. */
const clearOverrides = (): void => {
  overrides.clear();
};

/** Returns the registered default (if any) for `key`. */
const getDefault = (key: string): string | undefined => {
  return REGISTRY[key]?.default;
};

/** Returns the registration metadata for `key`, including secret/description. */
const getRegistration = (key: string): ConfigRegistration | undefined => {
  return REGISTRY[key];
};

/** Returns the registered keys, sorted. Used by the admin UI. */
const getRegisteredKeys = (): string[] => {
  return Object.keys(REGISTRY).sort();
};

/** Returns true if `key` was registered. */
const isRegistered = (key: string): boolean => {
  return key in REGISTRY;
};

/** Removes every registered key. Intended for tests. */
const clearRegistryForTesting = (): void => {
  for (const key of Object.keys(REGISTRY)) {
    delete REGISTRY[key];
  }
};

export const Config = {
  clearOverrides,
  clearRegistryForTesting,
  get: getString,
  getBoolean,
  getDefault,
  getJSON,
  getNumber,
  getRegisteredKeys,
  getRegistration,
  isRegistered,
  refresh,
  register,
  setCachedEnv,
  setEnvLoader,
  setOverride,
};

export type ConfigType = typeof Config;
