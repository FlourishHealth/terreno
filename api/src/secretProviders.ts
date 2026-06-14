import type {SecretProvider} from "./configurationPlugin";
import {APIError} from "./errors";
import {logger} from "./logger";

interface SecretManagerClient {
  accessSecretVersion(request: {name: string}): Promise<[{payload?: {data?: string | Uint8Array}}]>;
}

interface SecretManagerModule {
  SecretManagerServiceClient?: new () => SecretManagerClient;
  default?: {SecretManagerServiceClient?: new () => SecretManagerClient};
}

/**
 * Secret provider that reads secrets from environment variables.
 * Useful for local development and testing.
 *
 * Maps secret names to environment variable names by converting to SCREAMING_SNAKE_CASE.
 * e.g., "openai-api-key" → process.env.OPENAI_API_KEY
 *
 * @example
 * ```typescript
 * const provider = new EnvSecretProvider();
 * // reads process.env.OPENAI_API_KEY
 * const key = await provider.getSecret("openai-api-key");
 * ```
 */
export class EnvSecretProvider implements SecretProvider {
  name = "env";

  /**
   * Resolve a secret from an environment variable. Environment variables have no
   * versions, so the optional `version` parameter is ignored.
   */
  async getSecret(secretName: string, _version?: string): Promise<string | null> {
    // Convert secret name to env var format: "openai-api-key" → "OPENAI_API_KEY"
    const envKey = secretName.replace(/[-.]/g, "_").toUpperCase();
    const value = process.env[envKey] ?? null;
    if (value === null) {
      logger.debug(`EnvSecretProvider: no env var found for ${secretName} (tried ${envKey})`);
    }
    return value;
  }
}

/**
 * Options for GcpSecretProvider.
 */
export interface GcpSecretProviderOptions {
  /** GCP project ID. Required for short secret names. */
  projectId: string;
}

/**
 * Secret provider that reads secrets from Google Cloud Secret Manager.
 *
 * Requires `@google-cloud/secret-manager` to be installed.
 * Resolves short names like "openai-api-key" to the full resource path
 * `projects/{projectId}/secrets/{secretName}/versions/latest`.
 *
 * @example
 * ```typescript
 * const provider = new GcpSecretProvider({ projectId: "my-project" });
 * const key = await provider.getSecret("openai-api-key");
 * ```
 */
export class GcpSecretProvider implements SecretProvider {
  name = "gcp";
  private projectId: string;
  private client: SecretManagerClient | null = null;

  constructor(options: GcpSecretProviderOptions) {
    this.projectId = options.projectId;
  }

  private async getClient(): Promise<SecretManagerClient> {
    if (!this.client) {
      let mod: SecretManagerModule;
      try {
        // Dynamic import — @google-cloud/secret-manager is an optional peer dependency
        const moduleName = "@google-cloud/secret-manager";
        mod = await import(/* webpackIgnore: true */ moduleName);
      } catch {
        throw new APIError({
          status: 500,
          title:
            "GcpSecretProvider requires @google-cloud/secret-manager. Install it with: bun add @google-cloud/secret-manager",
        });
      }
      const SecretManagerServiceClient =
        mod.SecretManagerServiceClient ?? mod.default?.SecretManagerServiceClient;
      if (!SecretManagerServiceClient) {
        throw new APIError({
          status: 500,
          title: "SecretManagerServiceClient not found in @google-cloud/secret-manager module",
        });
      }
      this.client = new SecretManagerServiceClient();
    }
    return this.client;
  }

  /**
   * Resolve a secret from Google Cloud Secret Manager.
   *
   * @param secretName - A short secret id (e.g. "openai-api-key") or a full
   *   resource path (e.g. "projects/p/secrets/s" or
   *   "projects/p/secrets/s/versions/3").
   * @param version - Optional version to resolve when `secretName` is a short id
   *   (e.g. "3"). Defaults to "latest". Ignored when `secretName` already
   *   contains an explicit `/versions/...` suffix.
   */
  async getSecret(secretName: string, version?: string): Promise<string | null> {
    const client = await this.getClient();

    const resolvedVersion = version ?? "latest";
    let resourceName: string;
    if (secretName.startsWith("projects/")) {
      // Honor a full resource path. Only append a version when one is not present.
      resourceName = secretName.includes("/versions/")
        ? secretName
        : `${secretName}/versions/${resolvedVersion}`;
    } else {
      resourceName = `projects/${this.projectId}/secrets/${secretName}/versions/${resolvedVersion}`;
    }

    try {
      const [version] = await client.accessSecretVersion({name: resourceName});
      const payload = version.payload?.data;
      if (!payload) {
        logger.warn(`GcpSecretProvider: secret ${secretName} has no payload`);
        return null;
      }
      return typeof payload === "string" ? payload : new TextDecoder().decode(payload);
    } catch (error: unknown) {
      if (error instanceof Error && "code" in error && (error as {code: number}).code === 5) {
        // NOT_FOUND
        logger.warn(`GcpSecretProvider: secret ${secretName} not found`);
        return null;
      }
      throw error;
    }
  }
}

/**
 * Secret provider that delegates to an ordered list of providers, returning the
 * first non-null result.
 *
 * A provider that throws is warn-logged (secret name only — never the value) and
 * resolution falls through to the next provider. This makes it easy to compose a
 * primary provider with a fallback, e.g. GCP with an environment-variable
 * fallback:
 *
 * @example
 * ```typescript
 * const provider = new CompositeSecretProvider([
 *   new GcpSecretProvider({projectId: "my-project"}),
 *   new EnvSecretProvider(),
 * ]);
 * const key = await provider.getSecret("openai-api-key");
 * ```
 */
export class CompositeSecretProvider implements SecretProvider {
  name: string;
  private providers: SecretProvider[];

  constructor(providers: SecretProvider[]) {
    if (!providers || providers.length === 0) {
      throw new APIError({
        status: 500,
        title: "CompositeSecretProvider requires at least one provider",
      });
    }
    this.providers = providers;
    this.name = `composite(${providers.map((p) => p.name).join(",")})`;
  }

  async getSecret(secretName: string, version?: string): Promise<string | null> {
    for (const provider of this.providers) {
      try {
        const value = await provider.getSecret(secretName, version);
        if (value !== null) {
          return value;
        }
      } catch (error: unknown) {
        // Never log the secret value — only the name and which provider failed.
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(
          `CompositeSecretProvider: provider ${provider.name} failed for secret ${secretName}: ${message}`
        );
      }
    }
    return null;
  }
}

/**
 * Options for CachingSecretProvider.
 */
export interface CachingSecretProviderOptions {
  /** Time-to-live for cached values, in milliseconds. Defaults to 60_000 (1 minute). */
  ttlMs?: number;
}

interface CacheEntry {
  value: string | null;
  expiresAt: number;
}

/**
 * Secret provider that wraps any provider with an in-memory TTL cache.
 *
 * Cache entries are keyed by `secretName@version` so that pinned versions are
 * cached independently. `null` results (secret not found) are cached too, to
 * avoid hammering the underlying provider for missing secrets. Secret values are
 * never logged.
 *
 * Use `clear()` to drop the entire cache (e.g. on rotation) or `clearKey()` to
 * invalidate a single secret.
 *
 * @example
 * ```typescript
 * const provider = new CachingSecretProvider(
 *   new CompositeSecretProvider([gcp, env]),
 *   {ttlMs: 30_000}
 * );
 * ```
 */
export class CachingSecretProvider implements SecretProvider {
  name: string;
  private provider: SecretProvider;
  private ttlMs: number;
  private cache = new Map<string, CacheEntry>();

  constructor(provider: SecretProvider, options?: CachingSecretProviderOptions) {
    this.provider = provider;
    this.ttlMs = options?.ttlMs ?? 60_000;
    this.name = `caching(${provider.name})`;
  }

  private cacheKey(secretName: string, version?: string): string {
    return `${secretName}@${version ?? "latest"}`;
  }

  async getSecret(secretName: string, version?: string): Promise<string | null> {
    const key = this.cacheKey(secretName, version);
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const value = await this.provider.getSecret(secretName, version);
    this.cache.set(key, {expiresAt: now + this.ttlMs, value});
    return value;
  }

  /** Clears the entire cache. Useful on secret rotation and in tests. */
  clear(): void {
    this.cache.clear();
  }

  /** Invalidates a single cached secret by name (and optional version). */
  clearKey(secretName: string, version?: string): void {
    this.cache.delete(this.cacheKey(secretName, version));
  }
}
