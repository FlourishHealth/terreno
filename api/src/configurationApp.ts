import type express from "express";
import type {Model, Schema} from "mongoose";

import {asyncHandler, type RESTMethod} from "./api";
import {authenticateMiddleware} from "./auth";
import type {SecretFieldMeta} from "./configurationPlugin";
import {APIError} from "./errors";
import {logger} from "./logger";
import {checkPermissions, type PermissionMethod} from "./permissions";
import {getOpenApiSpecForModel} from "./populate";
import type {TerrenoPlugin} from "./terrenoPlugin";

/**
 * Middleware that requires the user to be an admin. Used as the default guard
 * for every configuration route when no custom `permissions` are supplied.
 */
const requireAdmin = (
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction
): void => {
  if (!req.user?.admin) {
    next(new APIError({status: 403, title: "Admin access required"}));
    return;
  }
  next();
};

/**
 * Builds an Express middleware that AND-combines terreno permission functions
 * (the same {@link PermissionMethod} contract used by `modelRouter`). The
 * configuration singleton has no per-object ownership, so the loaded config
 * document is passed as the permission object.
 */
const buildPermissionMiddleware = (
  perms: PermissionMethod<unknown>[],
  method: RESTMethod,
  loadObj?: () => Promise<unknown>
): express.RequestHandler =>
  asyncHandler(async (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const obj = loadObj ? await loadObj() : undefined;
    const allowed = await checkPermissions(method, perms, req.user, obj);
    if (!allowed) {
      throw new APIError({
        status: 403,
        title: "Access to configuration denied",
      });
    }
    next();
  });

/**
 * Metadata for a single configuration field, sent to the frontend.
 */
interface ConfigFieldMeta {
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
  default?: unknown;
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
 * Per-route permission overrides for ConfigurationApp. Each value is an array of
 * terreno permission functions ({@link PermissionMethod}), AND-combined like
 * `modelRouter` permissions. When a route is omitted, the default admin-only
 * guard applies.
 *
 * @example
 * ```typescript
 * permissions: {
 *   read: [IsStaff],
 *   update: [IsSuperUser],
 * }
 * ```
 */
export interface ConfigurationPermissions {
  /** Guards `GET {basePath}` (current values). */
  read?: PermissionMethod<unknown>[];
  /** Guards `PATCH {basePath}` (update values). */
  update?: PermissionMethod<unknown>[];
  /** Guards `GET {basePath}/meta` (schema metadata). */
  meta?: PermissionMethod<unknown>[];
  /** Guards `POST {basePath}/list-secrets` and `/validate-secrets`. */
  listSecrets?: PermissionMethod<unknown>[];
}

/**
 * Hook invoked before a configuration update is applied. Receives the incoming
 * (already system-field- and secret-field-stripped) body and the request, and
 * returns the body to apply. Use it to validate or normalize input. Throw an
 * {@link APIError} to reject the update.
 */
export type ConfigurationPreUpdateHook = (
  body: Record<string, unknown>,
  req: express.Request
) => Record<string, unknown> | Promise<Record<string, unknown>>;

/**
 * Hook invoked after a configuration update is applied. Receives the updated
 * configuration and the previous value (both with secret values redacted) plus
 * the request, enabling audit logging of who changed what. Secret values are
 * never included.
 */
export type ConfigurationPostUpdateHook = (
  config: Record<string, unknown>,
  prevValue: Record<string, unknown>,
  req: express.Request
) => void | Promise<void>;

/**
 * Options for ConfigurationApp.
 */
export interface ConfigurationAppOptions {
  /** The Mongoose model with configurationPlugin applied. */
  // noExplicitAny: Model<any> required for invariance — consumers pass arbitrary configuration models
  // biome-ignore lint/suspicious/noExplicitAny: Model<any> required for invariance — consumers pass arbitrary configuration models
  model: Model<any>;
  /** Base path for configuration routes. Defaults to "/configuration". */
  basePath?: string;
  /** Per-field widget overrides (e.g., {"ai.systemPrompt": "markdown"}). */
  fieldOverrides?: Record<string, {widget?: string}>;
  /**
   * Per-route permission overrides. Defaults to admin-only for every route when
   * omitted. Supply terreno permission functions (e.g. `[IsStaff]`) to expose
   * configuration to a consumer's own permission system.
   */
  permissions?: ConfigurationPermissions;
  /** Hook run before an update is applied (validation/normalization). */
  preUpdate?: ConfigurationPreUpdateHook;
  /** Hook run after an update is applied (audit logging). */
  postUpdate?: ConfigurationPostUpdateHook;
}

/**
 * Extracts field metadata from an OpenAPI properties object, augmented with
 * secret info from the Mongoose schema.
 */
interface OpenApiPropertyMeta {
  type?: string;
  default?: unknown;
  description?: string;
  enum?: string[];
}

const extractFieldMeta = (
  properties: Record<string, OpenApiPropertyMeta>,
  required: string[],
  schema: Schema,
  prefix: string,
  fieldOverrides?: Record<string, {widget?: string}>
): Record<string, ConfigFieldMeta> => {
  const fields: Record<string, ConfigFieldMeta> = {};
  for (const [key, prop] of Object.entries(properties)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const schemaPath = schema.path(fullPath);
    const opts = schemaPath?.options as
      | {description?: string; secret?: boolean; default?: unknown}
      | undefined;

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
const SYSTEM_FIELDS = new Set(["_id", "_singleton", "id", "__v", "created", "updated", "deleted"]);

const SECRET_REDACTED = "********";

/**
 * Redacts secret field values in a configuration object.
 * Replaces values at secret paths with a placeholder string.
 */
const redactSecrets = (
  obj: Record<string, unknown>,
  secretFields: SecretFieldMeta[]
): Record<string, unknown> => {
  const redacted: Record<string, unknown> = {...obj};
  for (const field of secretFields) {
    const parts = field.path.split(".");
    let current: Record<string, unknown> | null = redacted;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current) {
        break;
      }
      const part = parts[i];
      const nested = current[part];
      if (nested != null && typeof nested === "object") {
        const copy = {...(nested as Record<string, unknown>)};
        current[part] = copy;
        current = copy;
      } else {
        current = null;
        break;
      }
    }
    const lastKey = parts[parts.length - 1];
    if (current != null && current[lastKey] != null && current[lastKey] !== "") {
      current[lastKey] = SECRET_REDACTED;
    }
  }
  return redacted;
};

/**
 * Removes secret field values from an incoming update body so a secret value can
 * never be written to the configuration document through the update path.
 * Copies nodes along each secret path to avoid mutating the caller's object.
 */
const stripSecretFields = (
  obj: Record<string, unknown>,
  secretFields: SecretFieldMeta[]
): Record<string, unknown> => {
  const stripped: Record<string, unknown> = {...obj};
  for (const field of secretFields) {
    const parts = field.path.split(".");
    let current: Record<string, unknown> | null = stripped;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current) {
        break;
      }
      const part = parts[i];
      const nested = current[part];
      if (nested != null && typeof nested === "object") {
        const copy = {...(nested as Record<string, unknown>)};
        current[part] = copy;
        current = copy;
      } else {
        current = null;
        break;
      }
    }
    if (current != null) {
      delete current[parts[parts.length - 1]];
    }
  }
  return stripped;
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
 * - `GET {basePath}` — Current configuration values (secret values redacted)
 * - `PATCH {basePath}` — Update configuration values (secret fields stripped; never written)
 * - `POST {basePath}/list-secrets` (alias `POST {basePath}/validate-secrets`) —
 *   Read-only status of each secret field (whether the provider can resolve it).
 *   This endpoint never resolves values into the document and returns no secret values.
 *
 * By default all endpoints require `Permissions.IsAdmin`. Supply `permissions`
 * to gate routes with a consumer's own permission functions, and `preUpdate`/
 * `postUpdate` hooks to validate and audit-log changes. This makes
 * `ConfigurationApp` suitable as a single, consumer-owned configuration surface
 * that can replace a bespoke config router.
 *
 * Secret values never touch the database, logs, audit payloads, or API
 * responses: secret fields are stripped from incoming updates and redacted on
 * every read.
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
 *   .configure(AppConfig, {
 *     permissions: {read: [IsStaff], update: [IsSuperUser]},
 *     postUpdate: (config, prevValue, req) => auditLog(req.user, prevValue, config),
 *   })
 *   .start();
 * ```
 */
export class ConfigurationApp implements TerrenoPlugin {
  private options: ConfigurationAppOptions;

  constructor(options: ConfigurationAppOptions) {
    this.options = options;
  }

  /**
   * Resolves the guard middleware for a route: the consumer's terreno permission
   * functions when supplied, otherwise the default admin-only guard.
   */
  private guardFor(
    route: keyof ConfigurationPermissions,
    method: RESTMethod
  ): express.RequestHandler {
    const perms = this.options.permissions?.[route];
    if (perms && perms.length > 0) {
      return buildPermissionMiddleware(perms, method);
    }
    return requireAdmin;
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
      this.guardFor("meta", "read"),
      (_req: express.Request, res: express.Response) => {
        return res.json(meta);
      }
    );

    interface ConfigModelStatics {
      getSecretFields?: () => SecretFieldMeta[];
      getConfig: () => Promise<{toJSON: () => Record<string, unknown>}>;
      updateConfig: (
        body: Record<string, unknown>
      ) => Promise<{toJSON: () => Record<string, unknown>}>;
      resolveSecrets: () => Promise<Map<string, string>>;
    }
    const ConfigStatics = ConfigModel as unknown as ConfigModelStatics;

    // Discover secret fields once at registration time
    const secretFields: SecretFieldMeta[] = ConfigStatics.getSecretFields?.() ?? [];

    // GET /configuration — current values (secrets redacted)
    app.get(
      `${basePath}`,
      authenticateMiddleware(),
      this.guardFor("read", "read"),
      asyncHandler(async (_req: express.Request, res: express.Response) => {
        const config = await ConfigStatics.getConfig();
        const data = redactSecrets(config.toJSON(), secretFields);
        return res.json({data});
      })
    );

    // PATCH /configuration — update values (secret fields stripped; secrets redacted in response)
    app.patch(
      `${basePath}`,
      authenticateMiddleware(),
      this.guardFor("update", "update"),
      asyncHandler(async (req: express.Request, res: express.Response) => {
        // Strip internal system fields that should never be updated via the API.
        const {_singleton: _s, _id: _i, __v: _v, ...rest} = req.body;
        // Strip secret fields so a secret value can never be persisted via update.
        let safeBody = stripSecretFields(rest, secretFields);

        // Allow consumers to validate/normalize before applying.
        if (this.options.preUpdate) {
          safeBody = await this.options.preUpdate(safeBody, req);
          // Re-strip after the hook: preUpdate receives the raw request and could
          // otherwise (re)introduce secret paths. Secrets must never persist here.
          safeBody = stripSecretFields(safeBody, secretFields);
        }

        // Capture the previous (redacted) value for audit hooks.
        let prevValue: Record<string, unknown> = {};
        if (this.options.postUpdate) {
          const before = await ConfigStatics.getConfig();
          prevValue = redactSecrets(before.toJSON(), secretFields);
        }

        const config = await ConfigStatics.updateConfig(safeBody);
        logger.info(`Configuration updated by ${req.user?.email ?? "unknown"}`);
        const data = redactSecrets(config.toJSON(), secretFields);

        if (this.options.postUpdate) {
          await this.options.postUpdate(data, prevValue, req);
        }

        return res.json({data});
      })
    );

    // POST /configuration/list-secrets — read-only status of each secret field.
    // Never resolves values into the document and never returns secret values.
    const validateSecretsHandler = asyncHandler(
      async (_req: express.Request, res: express.Response) => {
        // In-memory resolution only — used to report whether each secret is
        // configured/resolvable. Values are never persisted or returned.
        const resolved: Map<string, string> = await ConfigStatics.resolveSecrets();
        const fields = secretFields.map((s) => ({
          isConfigured: resolved.has(s.path),
          path: s.path,
          resolvable: resolved.has(s.path),
          secretName: s.secretName,
          version: s.version,
        }));
        logger.info(`Validated ${resolved.size}/${secretFields.length} secrets (read-only)`);

        return res.json({
          message: `${resolved.size}/${secretFields.length} secrets resolvable.`,
          resolved: resolved.size,
          secretFields: fields,
          total: secretFields.length,
        });
      }
    );

    app.post(
      `${basePath}/list-secrets`,
      authenticateMiddleware(),
      this.guardFor("listSecrets", "read"),
      validateSecretsHandler
    );
    // Accurate alias for the read-only validation semantics.
    app.post(
      `${basePath}/validate-secrets`,
      authenticateMiddleware(),
      this.guardFor("listSecrets", "read"),
      validateSecretsHandler
    );

    logger.info(`Configuration routes mounted at ${basePath}`);
  }

  /**
   * Builds the metadata response by inspecting the model schema.
   * Top-level fields with subschemas become sections.
   * Top-level scalar fields go into a "General" section.
   */
  // noExplicitAny: Model<any> required for invariance with consumer-supplied configuration models
  // biome-ignore lint/suspicious/noExplicitAny: Model<any> required for invariance with consumer-supplied configuration models
  private buildMetadata(_model: Model<any>, schema: Schema): ConfigurationMetaResponse {
    const sections: ConfigSectionMeta[] = [];
    const generalFields: Record<string, ConfigFieldMeta> = {};

    // Walk top-level paths
    schema.eachPath((pathName, schemaType) => {
      if (SYSTEM_FIELDS.has(pathName)) {
        return;
      }

      const subSchema = (schemaType as unknown as {schema?: Schema}).schema;

      if (subSchema) {
        // This is a nested subschema — make it a section
        const {properties, required} = getOpenApiSpecForModel({
          modelName: pathName,
          schema: subSchema,
        } as unknown as Model<unknown>);

        // Filter out system fields from the subschema too
        const filteredProperties: Record<string, OpenApiPropertyMeta> = {};
        const filteredRequired: string[] = [];
        for (const [key, val] of Object.entries(properties)) {
          if (!SYSTEM_FIELDS.has(key)) {
            filteredProperties[key] = val as OpenApiPropertyMeta;
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
        const opts = schemaType.options as {description?: string} | undefined;

        sections.push({
          description: opts?.description,
          displayName: toDisplayName(pathName),
          fields: sectionFields,
          name: pathName,
        });
      } else {
        // Scalar top-level field — goes into "General" section
        const opts = schemaType.options as
          | {
              default?: unknown;
              description?: string;
              enum?: string[];
              required?: boolean;
              secret?: boolean;
            }
          | undefined;
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

  private mongooseTypeToString(schemaType: {instance?: string}): string {
    const instance = schemaType.instance?.toLowerCase();
    if (instance === "objectid") {
      return "string";
    }
    return instance ?? "string";
  }
}
