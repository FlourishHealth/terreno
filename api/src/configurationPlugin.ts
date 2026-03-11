import type {Document, Model, Schema} from "mongoose";

import {APIError} from "./errors";
import {logger} from "./logger";

/**
 * Metadata for a secret field discovered by the configuration plugin.
 */
export interface SecretFieldMeta {
  path: string;
  secretProvider?: string;
  secretName: string;
}

/**
 * Interface for adapters that resolve secret values from external providers.
 */
export interface SecretProvider {
  name: string;
  getSecret(secretName: string): Promise<string | null>;
}

/**
 * Options passed to configurationPlugin.
 */
export interface ConfigurationPluginOptions {
  /**
   * Secret provider used when resolveSecrets() is called without an explicit provider.
   * Typically set during app startup so the model can resolve secrets on demand.
   */
  secretProvider?: SecretProvider;
}

// ---------------------------------------------------------------------------
// Path type utilities
// ---------------------------------------------------------------------------

/**
 * All dot-notation paths for a type T.
 * @example Paths<{a: {b: string}; c: number}> = "a" | "a.b" | "c"
 */
export type Paths<T extends object> = {
  [K in keyof T & string]: T[K] extends object ? K | `${K}.${Paths<T[K]>}` : K;
}[keyof T & string];

/**
 * The value type at a dot-notation path P within type T.
 * @example PathValue<{a: {b: string}}, "a.b"> = string
 */
export type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<NonNullable<T[K]>, Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/**
 * Deeply partial version of T, for use in updateConfig.
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// ---------------------------------------------------------------------------
// Statics interface
// ---------------------------------------------------------------------------

/**
 * Static methods added by configurationPlugin to the Mongoose model.
 */
export interface ConfigurationStatics<T extends object> {
  /** Get the full singleton configuration document. */
  getConfig(): Promise<T & Document>;
  /** Get a specific value by dot-notation key. */
  getConfig<P extends Paths<T>>(key: P): Promise<PathValue<T, P>>;
  /** Update the singleton configuration document (deep merge). */
  updateConfig(updates: DeepPartial<T>): Promise<T & Document>;
  /** Get secret field metadata discovered from the schema. */
  getSecretFields(): SecretFieldMeta[];
  /**
   * Resolve all secret field values from a provider.
   * Uses the provider passed here, or falls back to the one configured in the plugin options.
   * Returns a map of path -> value.
   */
  resolveSecrets(provider?: SecretProvider): Promise<Map<string, string>>;
}

/**
 * Convenience type for a Mongoose model with configurationPlugin applied.
 *
 * Use this when declaring your configuration model to get full type safety:
 * ```typescript
 * export const AppConfig = mongoose.model<AppConfigDocument, ConfigurationModel<AppConfigDocument>>(
 *   "AppConfig",
 *   appConfigSchema,
 * );
 * // Then call:
 * const name = await AppConfig.getConfig("general.appName"); // typed as string
 * const full = await AppConfig.getConfig(); // typed as AppConfigDocument
 * ```
 */
export type ConfigurationModel<T extends object> = Model<T> & ConfigurationStatics<T>;

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * Mongoose schema plugin that adds singleton configuration behavior.
 *
 * Adds:
 * - Pre-save hook enforcing exactly one document
 * - `getConfig()` static: fetches or creates the singleton (full doc or keyed value)
 * - `updateConfig(updates)` static: patches the singleton
 * - `getSecretFields()` static: returns metadata for fields with `secret: true`
 * - `resolveSecrets(provider?)` static: fetches secret values, using the plugin provider by default
 *
 * Mark fields as secrets using schema path options:
 * ```typescript
 * const configSchema = new Schema({
 *   apiKey: {
 *     type: String,
 *     description: "Third-party API key",
 *     secret: true,
 *     secretName: "my-api-key",
 *   },
 * });
 * configSchema.plugin(configurationPlugin, {secretProvider: new EnvSecretProvider()});
 * ```
 */
export const configurationPlugin = (schema: Schema, options?: ConfigurationPluginOptions): void => {
  const pluginOptions = options ?? {};

  // Add a sentinel field with a unique index to enforce singleton at the DB level.
  // All config documents get _singleton: "config", and the unique index prevents duplicates.
  schema.add({
    _singleton: {default: "config", immutable: true, select: false, type: String},
  });
  schema.index({_singleton: 1}, {unique: true});

  // Enforce singleton: only one document allowed (application-level guard)
  schema.pre("save", async function () {
    if (this.isNew) {
      // Intentional unfiltered findOne — checking if any singleton document exists
      const existing = await (this.constructor as Model<unknown>).findOne({});
      if (existing) {
        throw new APIError({
          status: 409,
          title: "Only one configuration document is allowed. Use updateConfig() instead.",
        });
      }
    }
  });

  // Prevent hard deletion of the singleton (soft deletes via isDeletedPlugin still work)
  const createHardDeleteError = (): APIError =>
    new APIError({
      status: 400,
      title:
        "Cannot hard-delete the configuration document. Use updateConfig() or soft delete instead.",
    });

  schema.pre("deleteOne", {document: true, query: true}, () => {
    throw createHardDeleteError();
  });
  schema.pre("deleteMany", () => {
    throw createHardDeleteError();
  });
  schema.pre("findOneAndDelete", () => {
    throw createHardDeleteError();
  });

  // Static: get the singleton configuration document or a value at a path (race-safe via upsert)
  schema.statics.getConfig = async function (key?: string): Promise<unknown> {
    let config = await this.findOne({});
    if (!config) {
      try {
        // Use `new` + `save` instead of `create({})` so Mongoose initializes
        // nested subdocument defaults (create({}) skips them).
        config = new this();
        await config.save();
      } catch (err: unknown) {
        // If another process created the document between findOne and create,
        // the pre-save hook will throw a 409. Just fetch the existing one.
        if ((err as {status?: number})?.status === 409) {
          config = await this.findOne({});
        } else {
          throw err;
        }
      }
    }

    if (key === undefined) {
      return config;
    }

    // Resolve dot-notation key into the document
    const parts = key.split(".");
    let value: unknown = config.toObject();
    for (const part of parts) {
      if (value == null || typeof value !== "object") {
        return undefined;
      }
      value = (value as Record<string, unknown>)[part];
    }
    return value;
  };

  // Static: update the singleton configuration document (race-safe)
  schema.statics.updateConfig = async function (
    updates: Record<string, unknown>
  ): Promise<unknown> {
    const config = await (this as ConfigurationModel<Record<string, unknown>>).getConfig();
    Object.assign(config, updates);
    await (config as Document).save();
    return config;
  };

  // Static: discover secret fields from schema options
  schema.statics.getSecretFields = function (): SecretFieldMeta[] {
    const secrets: SecretFieldMeta[] = [];
    const discoverSecrets = (s: Schema, prefix: string) => {
      s.eachPath((pathName, schemaType) => {
        const opts = schemaType.options as Record<string, unknown>;
        if (opts?.secret === true) {
          secrets.push({
            path: prefix ? `${prefix}.${pathName}` : pathName,
            secretName: (opts.secretName as string) ?? pathName,
            secretProvider: opts.secretProvider as string | undefined,
          });
        }
        // Recurse into subschemas
        if ((schemaType as {schema?: Schema}).schema) {
          discoverSecrets(
            (schemaType as {schema: Schema}).schema,
            prefix ? `${prefix}.${pathName}` : pathName
          );
        }
      });
    };
    discoverSecrets(this.schema, "");
    return secrets;
  };

  // Static: resolve secret values from a provider
  schema.statics.resolveSecrets = async function (
    provider?: SecretProvider
  ): Promise<Map<string, string>> {
    const resolvedProvider = provider ?? pluginOptions.secretProvider;
    if (!resolvedProvider) {
      logger.warn(
        "resolveSecrets called with no provider. Pass a SecretProvider to resolveSecrets() or configurationPlugin options."
      );
      return new Map();
    }

    const secrets = (this as ConfigurationModel<Record<string, unknown>>).getSecretFields();
    const resolved = new Map<string, string>();

    const results = await Promise.allSettled(
      secrets.map(async (meta: SecretFieldMeta) => {
        const value = await resolvedProvider.getSecret(meta.secretName);
        if (value !== null) {
          resolved.set(meta.path, value);
        }
      })
    );

    let failCount = 0;
    for (const result of results) {
      if (result.status === "rejected") {
        failCount++;
        logger.error(`Failed to resolve secret: ${result.reason}`);
      }
    }

    if (failCount > 0) {
      logger.warn(`${failCount}/${secrets.length} secrets failed to resolve`);
    } else if (secrets.length > 0) {
      logger.info(
        `Resolved ${resolved.size}/${secrets.length} secrets from ${resolvedProvider.name}`
      );
    }

    return resolved;
  };
};
