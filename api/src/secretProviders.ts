import type {SecretProvider} from "./configurationPlugin";
import {APIError} from "./errors";
import {logger} from "./logger";

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

  async getSecret(secretName: string): Promise<string | null> {
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
  private client: any = null;

  constructor(options: GcpSecretProviderOptions) {
    this.projectId = options.projectId;
  }

  private async getClient(): Promise<any> {
    if (!this.client) {
      try {
        // Dynamic import — @google-cloud/secret-manager is an optional peer dependency
        const moduleName = "@google-cloud/secret-manager";
        const mod: any = await import(/* webpackIgnore: true */ moduleName);
        const SecretManagerServiceClient =
          mod.SecretManagerServiceClient ?? mod.default?.SecretManagerServiceClient;
        this.client = new SecretManagerServiceClient();
      } catch {
        throw new APIError({
          status: 500,
          title:
            "GcpSecretProvider requires @google-cloud/secret-manager. Install it with: bun add @google-cloud/secret-manager",
        });
      }
    }
    return this.client;
  }

  async getSecret(secretName: string): Promise<string | null> {
    const client = await this.getClient();

    let resourceName: string;
    if (secretName.startsWith("projects/")) {
      resourceName = secretName.endsWith("/versions/latest")
        ? secretName
        : `${secretName}/versions/latest`;
    } else {
      resourceName = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;
    }

    try {
      const [version] = await client.accessSecretVersion({name: resourceName});
      const payload = version.payload?.data;
      if (!payload) {
        logger.warn(`GcpSecretProvider: secret ${secretName} has no payload`);
        return null;
      }
      return typeof payload === "string" ? payload : new TextDecoder().decode(payload);
    } catch (error: any) {
      if (error?.code === 5) {
        // NOT_FOUND
        logger.warn(`GcpSecretProvider: secret ${secretName} not found`);
        return null;
      }
      throw error;
    }
  }
}
