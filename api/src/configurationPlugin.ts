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
 * Static methods added by configurationPlugin to the Mongoose model.
 */
export interface ConfigurationStatics<T> {
  /** Get the singleton configuration document, creating with defaults if none exists. */
  getConfig(): Promise<Document & T>;
  /** Update the singleton configuration document. */
  updateConfig(updates: Partial<T>): Promise<Document & T>;
  /** Get secret field metadata discovered from the schema. */
  getSecretFields(): SecretFieldMeta[];
  /** Resolve all secret field values from the configured provider. Returns a map of path -> value. */
  resolveSecrets(provider: SecretProvider): Promise<Map<string, string>>;
}

/**
 * Mongoose schema plugin that adds singleton configuration behavior.
 *
 * Adds:
 * - Pre-save hook enforcing exactly one document
 * - `getConfig()` static: fetches or creates the singleton
 * - `updateConfig(updates)` static: patches the singleton
 * - `getSecretFields()` static: returns metadata for fields with `secret: true`
 * - `resolveSecrets(provider)` static: fetches secret values from a SecretProvider
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
 * configSchema.plugin(configurationPlugin);
 * ```
 */
export const configurationPlugin = (schema: Schema): void => {
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
      const existing = await (this.constructor as Model<any>).findOne({});
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

  // Static: get the singleton configuration document (race-safe via upsert)
  schema.statics.getConfig = async function (): Promise<any> {
    let config = await this.findOne({});
    if (!config) {
      try {
        // Use `new` + `save` instead of `create({})` so Mongoose initializes
        // nested subdocument defaults (create({}) skips them).
        config = new this();
        await config.save();
      } catch (err: any) {
        // If another process created the document between findOne and create,
        // the pre-save hook will throw a 409. Just fetch the existing one.
        if (err?.status === 409) {
          config = await this.findOne({});
        } else {
          throw err;
        }
      }
    }
    return config;
  };

  // Static: update the singleton configuration document (race-safe)
  schema.statics.updateConfig = async function (updates: Record<string, any>): Promise<any> {
    const config = await (this as any).getConfig();
    Object.assign(config, updates);
    await config.save();
    return config;
  };

  // Static: discover secret fields from schema options
  schema.statics.getSecretFields = function (): SecretFieldMeta[] {
    const secrets: SecretFieldMeta[] = [];
    const discoverSecrets = (s: Schema, prefix: string) => {
      s.eachPath((pathName, schemaType) => {
        const opts = schemaType.options as any;
        if (opts?.secret === true) {
          secrets.push({
            path: prefix ? `${prefix}.${pathName}` : pathName,
            secretName: opts.secretName ?? pathName,
            secretProvider: opts.secretProvider,
          });
        }
        // Recurse into subschemas
        if ((schemaType as any).schema) {
          discoverSecrets((schemaType as any).schema, prefix ? `${prefix}.${pathName}` : pathName);
        }
      });
    };
    discoverSecrets(this.schema, "");
    return secrets;
  };

  // Static: resolve secret values from a provider
  schema.statics.resolveSecrets = async function (
    provider: SecretProvider
  ): Promise<Map<string, string>> {
    const secrets = (this as any).getSecretFields();
    const resolved = new Map<string, string>();

    const results = await Promise.allSettled(
      secrets.map(async (meta: SecretFieldMeta) => {
        const value = await provider.getSecret(meta.secretName);
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
      logger.info(`Resolved ${resolved.size}/${secrets.length} secrets from ${provider.name}`);
    }

    return resolved;
  };
};
