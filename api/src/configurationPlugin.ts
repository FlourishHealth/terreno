import type {Document, Model, Schema} from "mongoose";

import {APIError} from "./errors";
import {logger} from "./logger";
import {type FindOneOrNonePlugin, findOneOrNone} from "./plugins";

/**
 * Metadata for a secret field discovered by the configuration plugin.
 */
export interface SecretFieldMeta {
  path: string;
  secretProvider?: string;
  secretName: string;
  /**
   * Optional secret version to pin resolution to. When omitted the provider
   * resolves the latest version. Discovered from the `secretVersion` schema
   * path option.
   */
  version?: string;
}

/**
 * Interface for adapters that resolve secret values from external providers.
 */
export interface SecretProvider {
  name: string;
  /**
   * Resolve a secret value by name. Returns `null` when the secret is not found.
   *
   * @param secretName - The secret identifier (short name or provider-specific path).
   * @param version - Optional version to pin resolution to. Providers that do not
   *   support versioning (e.g. environment variables) ignore this parameter. When
   *   omitted, the latest version is resolved.
   */
  getSecret(secretName: string, version?: string): Promise<string | null>;
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
  /**
   * When `true`, adds a `_singleton` sentinel field with a unique index to
   * enforce the singleton constraint at the database level.
   *
   * Defaults to `false`. Leave this off when the consuming app already enforces
   * a single non-deleted document via the pre-save guard (the default behavior)
   * or via its own indexes/soft-delete plugin, to avoid double-enforcement and
   * conflicting indexes.
   *
   * @defaultValue false
   */
  enforceSingletonIndex?: boolean;
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
  /**
   * Update the singleton configuration document.
   *
   * The patch is flattened into MongoDB dotted paths and applied with
   * `findOneAndUpdate({$set})`. This preserves sibling fields inside nested
   * subdocuments when a partial nested patch is supplied, and tolerates legacy /
   * out-of-schema fields already persisted on the document (unlike a full
   * `doc.save()`, which throws under `strict: "throw"`).
   */
  updateConfig(updates: DeepPartial<T>): Promise<T & Document>;
  /** Get secret field metadata discovered from the schema. */
  getSecretFields(): SecretFieldMeta[];
  /**
   * Resolve all secret field values from a provider.
   * Uses the provider passed here, or falls back to the one configured in the plugin options.
   * Returns an **in-memory** map of path -> value for programmatic use (startup
   * self-checks, request-time resolution).
   *
   * This method never persists resolved values. Secret material must never be
   * written to the configuration document.
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
export interface ConfigurationModel<T extends object> extends Model<T>, ConfigurationStatics<T> {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flattens a nested patch into MongoDB-style dotted paths, recursing into plain
 * objects only; arrays and other values are treated as leaves.
 *
 * @example
 * flattenToDotPaths({a: {b: 1}}) // => [["a.b", 1]]
 */
export const flattenToDotPaths = (
  obj: Record<string, unknown>,
  prefix = ""
): Array<[string, unknown]> => {
  const out: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const isPlainObject =
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype;
    if (isPlainObject) {
      out.push(...flattenToDotPaths(value as Record<string, unknown>, path));
    } else {
      out.push([path, value]);
    }
  }
  return out;
};

/**
 * Builds the filter used to locate the singleton document. When the schema is
 * soft-delete aware (has a `deleted` path, e.g. via `isDeletedPlugin`), the
 * singleton is "the one non-deleted document"; otherwise any document matches.
 */
const buildSingletonFilter = (schema: Schema): Record<string, unknown> => {
  return schema.path("deleted") ? {deleted: false} : {};
};

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * Mongoose schema plugin that adds singleton configuration behavior.
 *
 * Adds:
 * - Pre-save hook enforcing exactly one non-deleted document (soft-delete aware
 *   when the schema has a `deleted` path, e.g. via `isDeletedPlugin`)
 * - `getConfig()` static: fetches or creates the singleton (full doc or keyed value)
 * - `updateConfig(updates)` static: patches the singleton via `findOneAndUpdate({$set})`
 *   with dotted paths (preserves sibling subdoc fields; tolerates legacy fields)
 * - `getSecretFields()` static: returns metadata for fields with `secret: true`
 * - `resolveSecrets(provider?)` static: resolves secret values into an in-memory map,
 *   using the plugin provider by default (never persists values)
 * - Hard-delete blockers (`deleteOne`/`deleteMany`/`findOneAndDelete`); soft deletes
 *   (setting `deleted: true`) are allowed
 *
 * Soft deletes are allowed and a soft-deleted document does not block creating a
 * new singleton. The `_singleton` unique index is opt-in via
 * `enforceSingletonIndex` (default off).
 *
 * Mark fields as secrets using schema path options. Pin a version with the
 * optional `secretVersion` option:
 * ```typescript
 * const configSchema = new Schema({
 *   apiKey: {
 *     type: String,
 *     description: "Third-party API key",
 *     secret: true,
 *     secretName: "my-api-key",
 *     secretVersion: "3", // optional — resolves "latest" when omitted
 *   },
 * });
 * configSchema.plugin(configurationPlugin, {secretProvider: new EnvSecretProvider()});
 * ```
 */
export const configurationPlugin = (schema: Schema, options?: ConfigurationPluginOptions): void => {
  const pluginOptions = options ?? {};

  // Apply findOneOrNone so the singleton lookup avoids bare Model.findOne (idempotent).
  findOneOrNone(schema);

  // Optionally add a sentinel field with a unique index to enforce the singleton
  // at the database level. This is opt-in (default off) so it does not conflict
  // with consumers that already enforce a single non-deleted document via the
  // pre-save guard below or via their own soft-delete plugin/indexes.
  if (pluginOptions.enforceSingletonIndex) {
    schema.add({
      _singleton: {
        default: "config",
        description: "Sentinel field enforcing singleton constraint",
        immutable: true,
        select: false,
        type: String,
      },
    });
    schema.index({_singleton: 1}, {unique: true});
  }

  // Enforce singleton: only one non-deleted document allowed (application-level
  // guard). Soft-delete-aware: a soft-deleted document does not block creating a
  // new singleton.
  schema.pre("save", async function () {
    if (this.isNew) {
      const filter = buildSingletonFilter(schema);
      // Cheap existence check — no document needs to be returned.
      const existing = await (this.constructor as Model<unknown>).exists(filter);
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
    const singletonFilter = buildSingletonFilter(this.schema);
    const findSingleton = (): Promise<Document | null> =>
      (this as unknown as FindOneOrNonePlugin<unknown>).findOneOrNone(
        singletonFilter
      ) as Promise<Document | null>;
    let config: Document | null = await findSingleton();
    if (!config) {
      try {
        // Use `new` + `save` instead of `create({})` so Mongoose initializes
        // nested subdocument defaults (create({}) skips them).
        const created = new this();
        await created.save();
        config = created;
      } catch (err: unknown) {
        // If another process created the document between the lookup and create,
        // the pre-save hook will throw a 409. Just fetch the existing one.
        if ((err as {status?: number})?.status === 409) {
          config = await findSingleton();
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
    let value: unknown = config?.toObject();
    for (const part of parts) {
      if (value == null || typeof value !== "object") {
        return undefined;
      }
      value = (value as Record<string, unknown>)[part];
    }
    return value;
  };

  // Static: update the singleton configuration document via $set dotted paths.
  // Flattening to dotted paths preserves sibling subdoc fields and tolerates
  // legacy/out-of-schema fields already persisted on the document.
  schema.statics.updateConfig = async function (
    updates: Record<string, unknown>
  ): Promise<unknown> {
    const singletonFilter = buildSingletonFilter(this.schema);
    const setFields: Record<string, unknown> = {};
    for (const [path, value] of flattenToDotPaths(updates)) {
      setFields[path] = value;
    }

    // Nothing to set — return the current singleton (creating it if missing).
    if (Object.keys(setFields).length === 0) {
      return (this as unknown as ConfigurationModel<Record<string, unknown>>).getConfig();
    }

    // runValidators keeps schema validation (enum/min/custom validators) on the
    // patched paths, matching the prior doc.save() behavior. Legacy/out-of-schema
    // fields already on the document are untouched (not in $set), so they are not
    // re-validated.
    const updated = await this.findOneAndUpdate(
      singletonFilter,
      {$set: setFields},
      {new: true, runValidators: true}
    );
    if (updated) {
      return updated;
    }

    // No singleton yet — create one (with subdocument defaults applied), then
    // apply the patch.
    await (this as unknown as ConfigurationModel<Record<string, unknown>>).getConfig();
    return this.findOneAndUpdate(
      singletonFilter,
      {$set: setFields},
      {new: true, runValidators: true}
    ).orFail();
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
            version: opts.secretVersion as string | undefined,
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
        const value = await resolvedProvider.getSecret(meta.secretName, meta.version);
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
