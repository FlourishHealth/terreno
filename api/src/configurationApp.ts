import type express from "express";
import type {Model, Schema} from "mongoose";

import {asyncHandler} from "./api";
import {authenticateMiddleware} from "./auth";
import type {SecretFieldMeta, SecretProvider} from "./configurationPlugin";
import {APIError} from "./errors";
import {logger} from "./logger";
import {getOpenApiSpecForModel} from "./populate";
import type {TerrenoPlugin} from "./terrenoPlugin";

/**
 * Middleware that requires the user to be an admin.
 */
const requireAdmin = (
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction
): void => {
  if (!(req as any).user?.admin) {
    next(new APIError({status: 403, title: "Admin access required"}));
    return;
  }
  next();
};

/**
 * Metadata for a single configuration field, sent to the frontend.
 */
interface ConfigFieldMeta {
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
  default?: any;
  secret?: boolean;
  widget?: string;
}

/**
 * Metadata for a configuration section (nested subschema).
 */
interface ConfigSectionMeta {
  name: string;
  displayName: string;
  description?: string;
  fields: Record<string, ConfigFieldMeta>;
}

/**
 * The config metadata response shape sent to the frontend.
 */
export interface ConfigurationMetaResponse {
  sections: ConfigSectionMeta[];
}

/**
 * Options for ConfigurationApp.
 */
export interface ConfigurationAppOptions {
  /** The Mongoose model with configurationPlugin applied. */
  model: Model<any>;
  /** Base path for configuration routes. Defaults to "/configuration". */
  basePath?: string;
  /** Per-field widget overrides (e.g., {"ai.systemPrompt": "markdown"}). */
  fieldOverrides?: Record<string, {widget?: string}>;
  /** Secret provider for resolving secret field values. */
  secretProvider?: SecretProvider;
}

/**
 * Extracts field metadata from an OpenAPI properties object, augmented with
 * secret info from the Mongoose schema.
 */
const extractFieldMeta = (
  properties: Record<string, any>,
  required: string[],
  schema: Schema,
  prefix: string,
  fieldOverrides?: Record<string, {widget?: string}>
): Record<string, ConfigFieldMeta> => {
  const fields: Record<string, ConfigFieldMeta> = {};
  for (const [key, prop] of Object.entries(properties)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const schemaPath = schema.path(fullPath);
    const opts = schemaPath?.options as any;

    fields[key] = {
      default: prop.default,
      description: opts?.description ?? prop.description,
      enum: prop.enum,
      required: required.includes(key),
      secret: opts?.secret === true,
      type: prop.type ?? "string",
    };

    // Apply field overrides
    if (fieldOverrides?.[fullPath]?.widget) {
      fields[key].widget = fieldOverrides[fullPath].widget;
    }
  }
  return fields;
};

/**
 * System fields to skip in configuration sections.
 */
const SYSTEM_FIELDS = new Set(["_id", "id", "__v", "created", "updated", "deleted"]);

const SECRET_REDACTED = "********";

/**
 * Redacts secret field values in a configuration object.
 * Replaces values at secret paths with a placeholder string.
 */
const redactSecrets = (
  obj: Record<string, any>,
  secretFields: SecretFieldMeta[]
): Record<string, any> => {
  const redacted = {...obj};
  for (const field of secretFields) {
    const parts = field.path.split(".");
    let current: any = redacted;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] != null && typeof current[parts[i]] === "object") {
        current[parts[i]] = {...current[parts[i]]};
        current = current[parts[i]];
      } else {
        current = null;
        break;
      }
    }
    const lastKey = parts[parts.length - 1];
    if (current != null && current[lastKey] != null) {
      current[lastKey] = SECRET_REDACTED;
    }
  }
  return redacted;
};

/**
 * Converts a camelCase or PascalCase string into a display-friendly title.
 */
const toDisplayName = (name: string): string => {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
};

/**
 * TerrenoPlugin that provides configuration management endpoints.
 *
 * Inspects the Mongoose configuration model to auto-generate:
 * - `GET {basePath}/meta` — Schema metadata (sections, fields, types, descriptions)
 * - `GET {basePath}` — Current configuration values
 * - `PATCH {basePath}` — Update configuration values
 * - `POST {basePath}/refresh-secrets` — Trigger secret refresh (if provider configured)
 *
 * All endpoints require `Permissions.IsAdmin`.
 *
 * Nested subschemas in the model become separate sections in the metadata,
 * making them renderable as cards/accordions in the admin UI.
 *
 * @example
 * ```typescript
 * import {ConfigurationApp, configurationPlugin} from "@terreno/api";
 *
 * const configSchema = new Schema({
 *   general: { type: new Schema({
 *     appName: { type: String, description: "App display name", default: "My App" },
 *     maintenanceMode: { type: Boolean, description: "Enable maintenance mode", default: false },
 *   })},
 *   integrations: { type: new Schema({
 *     openAiKey: { type: String, description: "OpenAI API key", secret: true, secretName: "openai-key" },
 *   })},
 * });
 * configSchema.plugin(configurationPlugin);
 * const AppConfig = mongoose.model("AppConfig", configSchema);
 *
 * new TerrenoApp({ userModel: User })
 *   .configure(AppConfig)
 *   .start();
 * ```
 */
export class ConfigurationApp implements TerrenoPlugin {
  private options: ConfigurationAppOptions;

  constructor(options: ConfigurationAppOptions) {
    this.options = options;
  }

  register(app: express.Application): void {
    const basePath = this.options.basePath ?? "/configuration";
    const ConfigModel = this.options.model;
    const schema = ConfigModel.schema;

    // Build metadata by inspecting the schema
    const meta = this.buildMetadata(ConfigModel, schema);

    // GET /configuration/meta — schema metadata for the frontend
    app.get(
      `${basePath}/meta`,
      authenticateMiddleware(),
      requireAdmin,
      (_req: express.Request, res: express.Response) => {
        return res.json(meta);
      }
    );

    // Discover secret fields once at registration time
    const secretFields: SecretFieldMeta[] = (ConfigModel as any).getSecretFields?.() ?? [];

    // GET /configuration — current values (secrets redacted)
    app.get(
      `${basePath}`,
      authenticateMiddleware(),
      requireAdmin,
      asyncHandler(async (_req: express.Request, res: express.Response) => {
        const config = await (ConfigModel as any).getConfig();
        const data = redactSecrets(config.toJSON(), secretFields);
        return res.json({data});
      })
    );

    // PATCH /configuration — update values (secrets redacted in response)
    app.patch(
      `${basePath}`,
      authenticateMiddleware(),
      requireAdmin,
      asyncHandler(async (req: express.Request, res: express.Response) => {
        const config = await (ConfigModel as any).updateConfig(req.body);
        logger.info(`Configuration updated by ${(req as any).user?.email ?? "unknown"}`);
        const data = redactSecrets(config.toJSON(), secretFields);
        return res.json({data});
      })
    );

    // POST /configuration/refresh-secrets — resolve secrets from provider and update config
    app.post(
      `${basePath}/refresh-secrets`,
      authenticateMiddleware(),
      requireAdmin,
      asyncHandler(async (_req: express.Request, res: express.Response) => {
        const provider = this.options.secretProvider;
        if (!provider) {
          return res.json({
            message: "No secret provider configured.",
            secretFields: secretFields.map((s) => ({
              path: s.path,
              secretName: s.secretName,
            })),
          });
        }

        const resolved = await (ConfigModel as any).resolveSecrets(provider);
        if (resolved.size > 0) {
          const updates: Record<string, any> = {};
          for (const [path, value] of resolved) {
            updates[path] = value;
          }
          await (ConfigModel as any).updateConfig(updates);
          logger.info(
            `Refreshed ${resolved.size}/${secretFields.length} secrets from ${provider.name}`
          );
        }

        return res.json({
          message: `Resolved ${resolved.size}/${secretFields.length} secrets from ${provider.name}.`,
          resolved: resolved.size,
          total: secretFields.length,
        });
      })
    );

    logger.info(`Configuration routes mounted at ${basePath}`);
  }

  /**
   * Builds the metadata response by inspecting the model schema.
   * Top-level fields with subschemas become sections.
   * Top-level scalar fields go into a "General" section.
   */
  private buildMetadata(_model: Model<any>, schema: Schema): ConfigurationMetaResponse {
    const sections: ConfigSectionMeta[] = [];
    const generalFields: Record<string, ConfigFieldMeta> = {};

    // Walk top-level paths
    schema.eachPath((pathName, schemaType) => {
      if (SYSTEM_FIELDS.has(pathName)) {
        return;
      }

      const subSchema = (schemaType as any).schema as Schema | undefined;

      if (subSchema) {
        // This is a nested subschema — make it a section
        const {properties, required} = getOpenApiSpecForModel({
          modelName: pathName,
          schema: subSchema,
        } as any);

        // Filter out system fields from the subschema too
        const filteredProperties: Record<string, any> = {};
        const filteredRequired: string[] = [];
        for (const [key, val] of Object.entries(properties)) {
          if (!SYSTEM_FIELDS.has(key)) {
            filteredProperties[key] = val;
            if (required.includes(key)) {
              filteredRequired.push(key);
            }
          }
        }

        const sectionFields = extractFieldMeta(
          filteredProperties,
          filteredRequired,
          schema,
          pathName,
          this.options.fieldOverrides
        );

        // Get description from the parent path options
        const opts = schemaType.options as any;

        sections.push({
          description: opts?.description,
          displayName: toDisplayName(pathName),
          fields: sectionFields,
          name: pathName,
        });
      } else {
        // Scalar top-level field — goes into "General" section
        const opts = schemaType.options as any;
        const fullPath = pathName;

        generalFields[pathName] = {
          default: opts?.default,
          description: opts?.description,
          enum: opts?.enum,
          required: opts?.required === true,
          secret: opts?.secret === true,
          type: this.mongooseTypeToString(schemaType),
        };

        if (this.options.fieldOverrides?.[fullPath]?.widget) {
          generalFields[pathName].widget = this.options.fieldOverrides[fullPath].widget;
        }
      }
    });

    // Add general fields section if there are any
    if (Object.keys(generalFields).length > 0) {
      sections.unshift({
        displayName: "General",
        fields: generalFields,
        name: "__root__",
      });
    }

    return {sections};
  }

  private mongooseTypeToString(schemaType: any): string {
    const instance = schemaType.instance?.toLowerCase();
    if (instance === "objectid") {
      return "string";
    }
    return instance ?? "string";
  }
}
