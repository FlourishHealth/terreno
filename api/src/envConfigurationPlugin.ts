import type {Document, Model, Schema} from "mongoose";

import {Config} from "./config";
import {logger} from "./logger";
import {findOneOrNoneFor} from "./plugins";

/**
 * Adds an admin-editable `env: Map<string, string>` field to a Mongoose schema
 * and keeps the global `Config` cache in sync with it.
 *
 * Companion to `Config` (config.ts). Apply alongside `configurationPlugin`
 * when you want a singleton configuration document whose `env` map backs the
 * runtime Config registry:
 *
 * ```typescript
 * const schema = new Schema({...});
 * schema.plugin(configurationPlugin);
 * schema.plugin(envConfigurationPlugin);
 *
 * export const EnvConfig = mongoose.model("EnvConfig", schema);
 * ```
 *
 * Apps still call `Config.setEnvLoader(...)` once at startup to wire the
 * model into `Config.refresh()` — typically:
 *
 * ```typescript
 * import {findOneOrNoneFor} from "@terreno/api";
 *
 * Config.setEnvLoader(async () => {
 *   const doc = await findOneOrNoneFor(EnvConfig, {});
 *   return doc?.env ? Object.fromEntries(doc.env) : {};
 * });
 * await Config.refresh();
 * ```
 *
 * After that, the post-save / post-update hooks installed here keep the
 * cache fresh whenever the document changes, so callers reading
 * `Config.get("KEY")` see admin edits immediately.
 */

interface EnvDoc extends Document {
  env?: Map<string, string> | Record<string, string>;
}

const mapToObject = (
  env: Map<string, string> | Record<string, string> | undefined
): Record<string, string> => {
  if (!env) {
    return {};
  }
  if (env instanceof Map) {
    const out: Record<string, string> = {};
    for (const [k, v] of env) {
      out[k] = v;
    }
    return out;
  }
  return {...env};
};

const refreshFromDoc = async (Model: Model<unknown>): Promise<void> => {
  try {
    // biome-ignore lint/suspicious/noExplicitAny: doc shape determined by consumer schema
    const doc = (await findOneOrNoneFor(Model as Model<any>, {})) as
      | (Document & {env?: Map<string, string> | Record<string, string>})
      | null;
    Config.setCachedEnv(mapToObject(doc?.env));
  } catch (error) {
    logger.warn(
      `envConfigurationPlugin: failed to refresh Config cache: ${(error as Error).message}`
    );
  }
};

// biome-ignore lint/suspicious/noExplicitAny: Schema generics must be loose to accept arbitrary consumer schemas
export const envConfigurationPlugin = (schema: Schema<any, any, any, any>): void => {
  schema.add({
    env: {
      default: () => new Map<string, string>(),
      description:
        "Admin-editable overrides for runtime configuration. Keys are env-var names " +
        "(e.g. EXPO_ACCESS_TOKEN) and values are stored as strings. Overrides win " +
        "over process.env at read time via the Config registry.",
      of: String,
      type: Map,
    },
  });

  schema.post("save", async function (this: EnvDoc) {
    await refreshFromDoc(this.constructor as Model<unknown>);
  });

  schema.post("findOneAndUpdate", async function (this: {model: Model<unknown>}) {
    await refreshFromDoc(this.model);
  });

  schema.post("updateOne", async function (this: {model: Model<unknown>}) {
    await refreshFromDoc(this.model);
  });
};
