import {
  APIError,
  asyncHandler,
  authenticateMiddleware,
  BackgroundTask,
  type BackgroundTaskDocument,
  checkPermissions,
  createOpenApiBuilder,
  createScriptArgs,
  getOpenApiSpecForModel,
  type JSONValue,
  logger,
  type ModelRouterOptions,
  modelRouter,
  type OpenApiMiddleware,
  Permissions,
  type PopulatePath,
  type ScriptArgDef,
  type ScriptArgValue,
  type ScriptContext,
  type ScriptResult,
  type ScriptRunner,
  TaskCancelledError,
  type User,
  VersionConfig,
} from "@terreno/api";
import express from "express";
import {DateTime} from "luxon";
import type {Model} from "mongoose";
import mongoose from "mongoose";

import {
  ADMIN_SCHEMA_VERSION,
  type AdminActionInput,
  type AdminFieldsetInput,
  type AdminHomeInput,
  type AdminListFilter,
  type AdminModelPermissionsInput,
  buildAdminModelQueryFields,
  defaultBulkPatchAllowlistFrom,
  MAX_BULK_PATCH_IDS,
  normalizeAdminHome,
  SYSTEM_ADMIN_FIELDS,
} from "./adminUiV2";
import {RESERVED_SCRIPT_FLAGS} from "./scriptCli";

/**
 * Configuration for a single model in the admin panel.
 */
export interface AdminFieldOverride {
  /** Widget to use for this field in the admin form (e.g., "markdown") */
  widget?: string;
}

export interface AdminModelConfig {
  /** The Mongoose model to expose in the admin panel */
  // biome-ignore lint/suspicious/noExplicitAny: Model<T> is invariant; the admin panel must accept any document shape.
  model: Model<any>;
  /** Route path for this model's endpoints, relative to basePath (e.g., "/users") */
  routePath: string;
  /** Human-readable name shown in the admin UI (e.g., "Users") */
  displayName: string;
  /** Field names to display in the list view table */
  listFields: string[];
  /** Default sort order for list queries (e.g., "-created"). Defaults to "-created" if not provided. */
  defaultSort?: string;
  /** Per-field overrides for widget type and other display options */
  fieldOverrides?: Record<string, AdminFieldOverride>;
  /** Ordered list of field names for the form. Fields not listed are appended at the end. */
  fieldOrder?: string[];
  /** Fields to hide from admin forms/responses (e.g., password hash fields). */
  hiddenFields?: string[];
  /** Optional sidebar / nav grouping label for schema v2 shells */
  group?: string;
  /** Changelist columns (defaults to listFields) */
  listDisplay?: string[];
  /** Subset of list columns rendered as links to detail */
  listDisplayLinks?: string[];
  /** Fields the changelist may sort by (informational + future enforcement) */
  sortableFields?: string[];
  /** Fields exposed to text / quick search in the admin UI */
  searchFields?: string[];
  /** Typed list filters (queryFields-compatible on the wire) */
  filters?: AdminListFilter[];
  /** Form layout: grouped fields */
  fieldsets?: AdminFieldsetInput[];
  /** Fields shown read-only in forms; stripped from PATCH bodies server-side */
  readonlyFields?: string[];
  /** Declarative row / selection actions */
  actions?: AdminActionInput[];
  /** Fine-grained CRUD toggles for admin UI + route wiring */
  permissions?: AdminModelPermissionsInput;
  /** Suggested page size for the changelist */
  pageSize?: number;
  /** Mongoose populate paths for list/read responses (e.g. populated refs on consent responses). */
  populatePaths?: PopulatePath[];
  /** UI-only hint that live updates may be available */
  realtime?: boolean;
  /**
   * Field key used for the edit screen title (browser tab / stack header). When omitted, the
   * admin UI derives a label from common keys (`name`, `title`, …) then the first scalar
   * {@link listFields} column, matching audit label heuristics.
   */
  recordTitleField?: string;
  /** Allowlisted keys for POST .../bulk-patch (defaults from listFields minus system/readonly/hidden) */
  bulkPatchAllowlist?: string[];
  /**
   * Per-model `modelRouter` query filter (list and other query-shaped reads).
   * Same contract as {@link ModelRouterOptions.queryFilter} in `@terreno/api`: merge into the
   * Mongoose query, return the incoming `query` unchanged if allowed, or return `null` to yield
   * an empty list without error.
   */
  queryFilter?: (
    user?: User,
    query?: Record<string, unknown>
  ) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>;
}

/**
 * Configuration for a script that can be run from the admin panel.
 */
export interface AdminScriptConfig {
  /** Unique name for this script (used as route key) */
  name: string;
  /** Human-readable description shown in the admin UI */
  description: string;
  /**
   * Optional declarations for the arguments this script accepts. Drives CLI help,
   * type coercion, defaults, and validation. Scripts may still read undeclared
   * arguments via `ctx.args`.
   */
  args?: ScriptArgDef[];
  /** The function that executes the script. Must return string[] results. */
  runner: ScriptRunner;
}

/**
 * Emitted after successful admin modelRouter mutations when {@link AdminOptions.onAdminAudit}
 * is configured.
 */
export interface AdminAuditEvent {
  /** Terreno user id performing the action, when available */
  actorId?: string;
  /** Mongoose model name (e.g. "Todo") */
  modelName: string;
  /** Target document id when known */
  recordId?: string;
  /** Short human-readable label derived from list fields */
  recordLabel?: string;
  verb: "created" | "deleted" | "updated";
}

/** Declares an extra admin UI screen route merged with built-ins (e.g. version-config). */
export interface AdminCustomScreenConfig {
  displayName: string;
  name: string;
  /** Optional subtitle or help text shown with the screen card in the admin UI */
  description?: string;
}

/**
 * Configuration for the "create the first admin" bootstrap flow.
 * @see AdminOptions.firstAdminSetup
 */
export interface AdminFirstAdminSetupOptions {
  /**
   * Mongoose User model used to count existing admins and promote the first one.
   * Must have an `admin: boolean` field (e.g. via `baseUserPlugin`).
   */
  // biome-ignore lint/suspicious/noExplicitAny: Model<T> is invariant; must accept the consumer's User model shape.
  userModel: Model<any>;
}

/**
 * Configuration options for the AdminApp plugin.
 */
export interface AdminOptions {
  /** Array of model configurations to expose in the admin panel */
  models: AdminModelConfig[];
  /** Array of scripts that can be run from the admin panel */
  scripts?: AdminScriptConfig[];
  /** Base path for all admin routes. Defaults to "/admin". */
  basePath?: string;
  /** Optional home dashboard layout (schema v2 slots) */
  home?: AdminHomeInput;
  /** Extra custom screens merged with built-ins (e.g. version-config) */
  customScreens?: AdminCustomScreenConfig[];
  /**
   * Optional audit sink for admin CRUD after modelRouter succeeds.
   * Consumers typically persist to an `AdminAuditLog` collection.
   */
  onAdminAudit?: (event: AdminAuditEvent, req: express.Request) => void | Promise<void>;
  /**
   * Enables a "create the first admin" bootstrap flow for when no admin user exists yet
   * (e.g. a fresh deploy). When configured, registers:
   * - `GET {basePath}/setup-status` (public) — `{needsSetup: boolean}`
   * - `POST {basePath}/setup-claim` (authenticated) — promotes the signed-in user to
   *   `admin: true`, but only while no admin user exists yet.
   *
   * Account creation itself (sign up / sign in) is left to the app's existing auth flow
   * (JWT signup, Better Auth email sign-up, OAuth, ...) — this only "claims" the admin
   * flag for the first authenticated user while the app has zero admins.
   *
   * Set the `ADMIN_SETUP_DISABLED` environment variable to `"true"` to turn this off at
   * runtime (e.g. after the first admin has been created) without a deploy.
   */
  firstAdminSetup?: AdminFirstAdminSetupOptions;
}

interface AdminFieldMeta {
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
  default?: unknown;
  ref?: string;
  searchable?: boolean;
  widget?: string;
  /** For array fields of sub-documents: metadata about each item's sub-fields */
  items?: Record<string, AdminFieldMeta>;
  /** For array fields of primitives: the item type (string/number/boolean/objectid) */
  itemType?: string;
  /** For array fields of primitives: enum values for each item */
  itemEnum?: string[];
  /** For array fields of ObjectId refs: the referenced model name */
  itemRef?: string;
}

interface AdminModelMeta {
  actions: AdminActionInput[];
  bulkPatchAllowlist: string[];
  defaultSort: string;
  displayName: string;
  fieldOrder?: string[];
  fieldsets?: AdminFieldsetInput[];
  fields: Record<string, AdminFieldMeta>;
  filters: AdminListFilter[];
  group?: string;
  hiddenFields: string[];
  listDisplay: string[];
  listDisplayLinks: string[];
  listFields: string[];
  name: string;
  pageSize?: number;
  permissions: {create: boolean; delete: boolean; update: boolean};
  readonlyFields: string[];
  realtime: boolean;
  recordTitleField?: string;
  routePath: string;
  searchFields: string[];
  sortableFields: string[];
}

interface AdminScriptMeta {
  name: string;
  description: string;
  args: ScriptArgDef[];
}

interface AdminConfigResponse {
  customScreens?: AdminCustomScreenConfig[];
  home: ReturnType<typeof normalizeAdminHome>;
  models: AdminModelMeta[];
  schemaVersion: number;
  scripts: AdminScriptMeta[];
}

const toPlainObject = (value: unknown): Record<string, unknown> => {
  if (
    value &&
    typeof value === "object" &&
    "toObject" in value &&
    typeof value.toObject === "function"
  ) {
    return (value as {toObject: () => Record<string, unknown>}).toObject();
  }
  return value as Record<string, unknown>;
};

const removeHiddenFields = (value: unknown, hiddenFieldSet: Set<string>): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => removeHiddenFields(item, hiddenFieldSet));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const plainValue = toPlainObject(value);
  const nextValue: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(plainValue)) {
    if (!hiddenFieldSet.has(key)) {
      nextValue[key] = fieldValue;
    }
  }
  return nextValue;
};

const auditDocumentToPlain = (value: unknown): Record<string, unknown> => {
  if (
    value &&
    typeof value === "object" &&
    "toObject" in value &&
    typeof (value as {toObject?: unknown}).toObject === "function"
  ) {
    return (value as {toObject: () => Record<string, unknown>}).toObject();
  }
  return value as Record<string, unknown>;
};

const auditLabelFromListFields = (
  doc: Record<string, unknown>,
  listFields: string[]
): string | undefined => {
  for (const key of listFields) {
    const fieldValue = doc[key];
    if (fieldValue == null || typeof fieldValue === "object") {
      continue;
    }
    return String(fieldValue);
  }
  const id = doc._id;
  return id != null ? String(id) : undefined;
};

const auditActorId = (request: express.Request): string | undefined => {
  const user = request.user as {_id?: unknown} | undefined;
  if (!user || user._id == null) {
    return undefined;
  }
  return String(user._id);
};

interface OpenApiProperty {
  default?: unknown;
  description?: string;
  enum?: string[];
  $ref?: string;
  type?: string;
  format?: string;
  items?: {
    properties?: Record<string, OpenApiProperty>;
    required?: string[];
    type?: string;
    enum?: string[];
    format?: string;
    $ref?: string;
  };
}

const extractFieldMeta = (
  properties: Record<string, OpenApiProperty>,
  required: string[]
): Record<string, AdminFieldMeta> => {
  const fields: Record<string, AdminFieldMeta> = {};
  for (const [key, prop] of Object.entries(properties)) {
    const fieldType = prop.type ?? "string";
    fields[key] = {
      default: prop.default,
      description: prop.description,
      enum: prop.enum,
      ref: prop.$ref ? prop.$ref.replace("#/components/schemas/", "") : undefined,
      required: required.includes(key),
      searchable: fieldType === "string" && !prop.enum,
      type: fieldType,
    };

    // For array fields, extract item sub-field metadata
    if (prop.type === "array" && prop.items?.properties) {
      const itemRequired: string[] = prop.items.required ?? [];
      fields[key].items = extractFieldMeta(
        prop.items.properties as Record<string, OpenApiProperty>,
        itemRequired
      );
    }

    // For array fields of primitives, capture the item type and enum
    if (prop.type === "array" && prop.items && !prop.items.properties) {
      const itemProp = prop.items as OpenApiProperty;
      if (itemProp.type) {
        fields[key].itemType = itemProp.type;
      }
      if (itemProp.enum) {
        fields[key].itemEnum = itemProp.enum;
      }
    }

    // Check for ObjectId references in the raw property
    if (!fields[key].ref && prop.type === "string" && prop.format === "objectid") {
      // mongoose-to-swagger may not preserve ref directly; we'll handle this in register()
    }
  }
  return fields;
};

const asMiddlewareList = (
  middleware: express.RequestHandler | express.RequestHandler[] | undefined
): express.RequestHandler[] => {
  if (middleware === undefined) {
    return [];
  }
  if (Array.isArray(middleware)) {
    return middleware;
  }
  return [middleware];
};

/**
 * TerrenoPlugin that auto-generates admin CRUD endpoints for Mongoose models.
 *
 * Creates a metadata endpoint (`GET {basePath}/config`) and full CRUD routes for each
 * configured model. All routes require `Permissions.IsAdmin`.
 *
 * @example
 * ```typescript
 * import {AdminApp} from "@terreno/admin-backend";
 * import {User, Todo} from "./models";
 *
 * const admin = new AdminApp({
 *   basePath: "/admin",
 *   models: [
 *     {
 *       model: User,
 *       routePath: "/users",
 *       displayName: "Users",
 *       listFields: ["email", "name", "admin"],
 *       defaultSort: "-created",
 *     },
 *     {
 *       model: Todo,
 *       routePath: "/todos",
 *       displayName: "Todos",
 *       listFields: ["title", "completed", "ownerId"],
 *       // Optional: constrain admin list queries (e.g. tenant) — same as modelRouter queryFilter.
 *       queryFilter: (_user, query) => ({...query, tenantId: "acme"}),
 *     },
 *   ],
 * });
 *
 * // Register with TerrenoApp
 * new TerrenoApp({ userModel: User })
 *   .register(admin)
 *   .start();
 * ```
 *
 * @see AdminOptions for configuration options
 * @see AdminModelConfig for model configuration
 * @see TerrenoPlugin for the plugin interface
 */
export class AdminApp {
  private options: AdminOptions;

  /**
   * Create a new AdminApp plugin.
   *
   * @param options - Admin panel configuration including models and base path
   */
  constructor(options: AdminOptions) {
    this.options = options;
  }

  /**
   * Register admin routes with the Express application.
   *
   * Creates:
   * - `GET {basePath}/config` - Returns metadata for all configured models
   * - CRUD endpoints for each model at `{basePath}{model.routePath}`:
   *   - `GET /` - List with pagination
   *   - `POST /` - Create
   *   - `GET /:id` - Read single item
   *   - `PATCH /:id` - Update
   *   - `DELETE /:id` - Delete
   *
   * All endpoints require `Permissions.IsAdmin` authentication.
   *
   * @param app - The Express application instance to register with
   */
  register(app: express.Application, openApi?: unknown): void {
    const basePath = this.options.basePath ?? "/admin";
    const openApiMw = openApi as OpenApiMiddleware | undefined;
    const modelConfigs = this.options.models;
    const onAdminAudit = this.options.onAdminAudit;

    /** Audit is best-effort: failures must not change HTTP outcomes after mutations succeed. */
    const safeOnAdminAudit = async (
      request: express.Request,
      event: AdminAuditEvent
    ): Promise<void> => {
      if (!onAdminAudit) {
        return;
      }
      try {
        await onAdminAudit(event, request);
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : String(err);
        logger.error(`onAdminAudit failed after ${event.verb} on ${event.modelName}: ${detail}`);
      }
    };

    this.registerFirstAdminSetupRoutes(app, basePath, safeOnAdminAudit);

    // Build config response with field metadata from Mongoose schemas
    const configModels: AdminModelMeta[] = modelConfigs.map((config) => {
      const {properties, required} = getOpenApiSpecForModel(config.model) as {
        properties: Record<string, OpenApiProperty>;
        required: string[];
      };
      const hiddenFieldSet = new Set(config.hiddenFields ?? []);
      const filteredProperties = Object.fromEntries(
        Object.entries(properties).filter(([key]) => !hiddenFieldSet.has(key))
      );
      const filteredRequired = required.filter((key) => !hiddenFieldSet.has(key));

      // Extract ref information directly from the Mongoose schema
      const fields = extractFieldMeta(filteredProperties, filteredRequired);
      for (const [key, field] of Object.entries(fields)) {
        const schemaPath = config.model.schema.path(key);
        if (schemaPath) {
          const pathOptions = schemaPath.options;
          if (pathOptions?.ref) {
            field.ref = pathOptions.ref;
          }
          // Handle array of refs (legacy: also set ref for back-compat)
          if (Array.isArray(pathOptions?.type) && pathOptions.type[0]?.ref) {
            field.ref = pathOptions.type[0].ref;
          }
          // For arrays, use the caster to infer the primitive item type/ref.
          // Mongoose caster.instance is "String" | "Number" | "Boolean" | "ObjectID".
          if (schemaPath.instance === "Array") {
            const caster = (
              schemaPath as unknown as {
                caster?: {instance?: string; options?: {ref?: string; enum?: string[]}};
              }
            ).caster;
            if (caster?.instance && !field.items) {
              const instanceToType: Record<string, string> = {
                Boolean: "boolean",
                Number: "number",
                ObjectID: "objectid",
                ObjectId: "objectid",
                SchemaObjectId: "objectid",
                String: "string",
              };
              const mapped = instanceToType[caster.instance];
              if (mapped) {
                field.itemType = mapped;
              }
              if (caster.options?.ref) {
                field.itemRef = caster.options.ref;
              }
              if (caster.options?.enum) {
                field.itemEnum = caster.options.enum;
              }
            }
          }
        }
      }

      // Apply field overrides (e.g., widget: "markdown")
      if (config.fieldOverrides) {
        for (const [key, override] of Object.entries(config.fieldOverrides)) {
          if (fields[key] && override.widget) {
            fields[key].widget = override.widget;
          }
        }
      }

      const readonlyFields = config.readonlyFields ?? [];
      const listFields = config.listFields.filter((field) => !hiddenFieldSet.has(field));
      const listDisplay = config.listDisplay ?? listFields;
      const derivedSearchFields = listFields.filter((field) => fields[field]?.searchable);
      const searchFields = config.searchFields ?? derivedSearchFields;
      const sortableFields = config.sortableFields ?? [...listDisplay, "_id"];
      const schemaPathKeys = new Set(Object.keys(config.model.schema.paths));
      const bulkPatchAllowlist =
        config.bulkPatchAllowlist ??
        defaultBulkPatchAllowlistFrom({
          hiddenFieldSet,
          listFields,
          readonlyFields,
          schemaPaths: schemaPathKeys,
        });

      return {
        actions: config.actions ?? [],
        bulkPatchAllowlist,
        defaultSort: config.defaultSort ?? "-created",
        displayName: config.displayName,
        fieldOrder: config.fieldOrder,
        fields,
        fieldsets: config.fieldsets,
        filters: config.filters ?? [],
        group: config.group,
        hiddenFields: [...hiddenFieldSet],
        listDisplay,
        listDisplayLinks: config.listDisplayLinks ?? [],
        listFields,
        name: config.model.modelName,
        pageSize: config.pageSize,
        permissions: {
          create: config.permissions?.create !== false,
          delete: config.permissions?.delete !== false,
          update: config.permissions?.update !== false,
        },
        readonlyFields,
        realtime: config.realtime ?? false,
        recordTitleField: config.recordTitleField,
        routePath: `${basePath}${config.routePath}`,
        searchFields,
        sortableFields,
      };
    });

    // Build script metadata for config response
    const scriptConfigs = this.options.scripts ?? [];
    const configScripts: AdminScriptMeta[] = scriptConfigs.map((script) => ({
      args: script.args ?? [],
      description: script.description,
      name: script.name,
    }));

    const defaultScreens = [{displayName: "Version Config", name: "version-config"}];
    const mergedScreens = [...defaultScreens, ...(this.options.customScreens ?? [])];

    const configResponse: AdminConfigResponse = {
      customScreens: mergedScreens,
      home: normalizeAdminHome(this.options.home),
      models: configModels,
      schemaVersion: ADMIN_SCHEMA_VERSION,
      scripts: configScripts,
    };

    const adminConfigOpenApi = openApiMw
      ? createOpenApiBuilder({openApi: openApiMw})
          .withTags(["admin"])
          .withSummary("Admin panel configuration")
          .withResponse(200, {
            customScreens: {
              items: {
                properties: {
                  description: {type: "string"},
                  displayName: {type: "string"},
                  name: {type: "string"},
                },
                type: "object",
              },
              type: "array",
            },
            home: {type: "object"},
            models: {type: "array"},
            schemaVersion: {type: "number"},
            scripts: {
              items: {
                properties: {
                  args: {type: "array"},
                  description: {type: "string"},
                  name: {type: "string"},
                },
                type: "object",
              },
              type: "array",
            },
          })
          .build()
      : undefined;

    // GET /admin/config
    app.get(
      `${basePath}/config`,
      authenticateMiddleware(),
      ...asMiddlewareList(adminConfigOpenApi),
      asyncHandler(async (req, res) => {
        if (
          !(await checkPermissions("read", [Permissions.IsAdmin], req.user as User | undefined))
        ) {
          throw new APIError({status: 403, title: "Admin access required"});
        }
        return res.json(configResponse);
      })
    );

    const backgroundTasksOpenApi = openApiMw
      ? createOpenApiBuilder({openApi: openApiMw})
          .withTags(["admin"])
          .withSummary("Enqueue a generic admin background task")
          .withRequestBody<{
            ids?: string[];
            kind: string;
            metadata?: Record<string, unknown>;
            resourceRoute?: string;
          }>({
            ids: {
              description: "Optional target document ids",
              items: {type: "string"},
              type: "array",
            },
            kind: {
              description: "Task kind label persisted as taskType",
              required: true,
              type: "string",
            },
            metadata: {description: "Opaque JSON metadata for workers", type: "object"},
            resourceRoute: {
              description: "Optional admin model route this task relates to",
              type: "string",
            },
          })
          .withResponse(201, {taskId: {type: "string"}})
          .build()
      : undefined;

    app.post(
      `${basePath}/background-tasks`,
      authenticateMiddleware(),
      ...asMiddlewareList(backgroundTasksOpenApi),
      asyncHandler(async (req, res) => {
        if (
          !(await checkPermissions("update", [Permissions.IsAdmin], req.user as User | undefined))
        ) {
          throw new APIError({status: 403, title: "Admin access required"});
        }
        const user = req.user as {_id: unknown} | undefined;
        const raw = req.body as {
          ids?: unknown;
          kind?: unknown;
          metadata?: unknown;
          resourceRoute?: unknown;
        };
        if (typeof raw.kind !== "string" || !raw.kind.trim()) {
          throw new APIError({status: 400, title: "kind is required"});
        }
        const now = DateTime.now().toJSDate();
        const summary = {
          ids: Array.isArray(raw.ids) ? raw.ids : [],
          metadata:
            raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
              ? raw.metadata
              : {},
          resourceRoute: typeof raw.resourceRoute === "string" ? raw.resourceRoute : undefined,
        };
        let task: BackgroundTaskDocument;
        try {
          task = (await BackgroundTask.create({
            createdBy: user?._id as mongoose.Types.ObjectId,
            isDryRun: false,
            logs: [
              {
                level: "info",
                message: `Queued background task ${raw.kind}: ${JSON.stringify(summary)}`,
                timestamp: now,
              },
            ],
            progress: {message: "Queued", percentage: 0, stage: "Queued"},
            startedAt: now,
            status: "pending",
            taskType: raw.kind,
          })) as BackgroundTaskDocument;
        } catch (err: unknown) {
          const detail = err instanceof Error ? err.message : String(err);
          logger.error(`Failed to create admin background task: ${detail}`);
          throw new APIError({
            detail,
            status: 500,
            title: "Failed to enqueue background task",
          });
        }
        return res.status(201).json({taskId: task._id.toString()});
      })
    );

    // Version config singleton routes (GET/PUT /admin/version-config)
    const versionConfigPath = `${basePath}/version-config`;
    app.get(
      versionConfigPath,
      authenticateMiddleware(),
      asyncHandler(async (req, res) => {
        if (
          !(await checkPermissions("read", [Permissions.IsAdmin], req.user as User | undefined))
        ) {
          throw new APIError({status: 403, title: "Admin access required"});
        }
        const config = await VersionConfig.findOneOrNone({_singleton: "config"});
        const defaults = {
          mobileRequiredVersion: 0,
          mobileWarningVersion: 0,
          requiredMessage: "This version is no longer supported. Please update to continue.",
          updateUrl: undefined as string | undefined,
          warningMessage: "A new version is available. Please update for the best experience.",
          webRequiredVersion: 0,
          webWarningVersion: 0,
        };
        return res.json(config ?? defaults);
      })
    );
    app.put(
      versionConfigPath,
      authenticateMiddleware(),
      asyncHandler(async (req, res) => {
        if (
          !(await checkPermissions("update", [Permissions.IsAdmin], req.user as User | undefined))
        ) {
          throw new APIError({status: 403, title: "Admin access required"});
        }
        const raw = req.body as Record<string, unknown>;
        const allowedFields = [
          "mobileRequiredVersion",
          "mobileWarningVersion",
          "requiredMessage",
          "updateUrl",
          "webRequiredVersion",
          "webWarningVersion",
          "warningMessage",
        ] as const;
        const setFields: Record<string, unknown> = {};
        const unsetFields: Record<string, 1> = {};
        for (const field of allowedFields) {
          if (raw[field] === null) {
            unsetFields[field] = 1;
          } else if (raw[field] !== undefined) {
            setFields[field] = raw[field];
          }
        }
        const updateOp: Record<string, unknown> = {};
        if (Object.keys(setFields).length > 0) {
          updateOp.$set = setFields;
        }
        if (Object.keys(unsetFields).length > 0) {
          updateOp.$unset = unsetFields;
        }
        const doc = await VersionConfig.findOneAndUpdate({_singleton: "config"}, updateOp, {
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
          upsert: true,
        }).lean();
        return res.json(doc);
      })
    );

    // Mount search endpoint for each model
    for (const config of modelConfigs) {
      // Determine searchable fields from the actual Mongoose schema type,
      // not the OpenAPI type (which reports ObjectId as "string")
      const searchableFields: string[] = [];
      const objectIdFields: string[] = [];
      const modelMeta = configModels.find((m) => m.name === config.model.modelName);
      if (modelMeta) {
        for (const key of Object.keys(modelMeta.fields)) {
          const schemaPath = config.model.schema.path(key);
          if (schemaPath && schemaPath.instance === "String" && !modelMeta.fields[key].enum) {
            searchableFields.push(key);
          } else if (schemaPath && schemaPath.instance === "ObjectID") {
            objectIdFields.push(key);
          }
        }
      }

      app.get(
        `${basePath}${config.routePath}/search`,
        authenticateMiddleware(),
        asyncHandler(async (req, res) => {
          const user = req.user as {_id: unknown; admin?: boolean} | undefined;
          if (!user?.admin) {
            throw new APIError({
              disableExternalErrorTracking: true,
              status: 403,
              title: "Forbidden",
            });
          }
          const q = String(req.query.q ?? "");
          if (!q) {
            return res.json({data: []});
          }

          const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(escapedQ, "i");

          const fields =
            typeof req.query.fields === "string"
              ? req.query.fields.split(",").filter((f: string) => searchableFields.includes(f))
              : searchableFields;

          const orConditions = fields.map((field: string) => ({[field]: {$regex: regex}}));

          // If the query is a valid ObjectId, also match against ObjectId fields
          if (mongoose.isValidObjectId(q)) {
            for (const field of objectIdFields) {
              orConditions.push({[field]: new mongoose.Types.ObjectId(q)});
            }
          }

          if (orConditions.length === 0) {
            return res.json({data: []});
          }
          logger.debug("Admin search query", {
            fields,
            model: config.model.modelName,
            q,
          });
          try {
            const results = await config.model.find({$or: orConditions}).limit(20).lean();
            logger.debug("Admin search results", {
              count: results.length,
              model: config.model.modelName,
            });
            return res.json({data: results});
          } catch (err) {
            logger.error("Admin search failed", {
              error: err,
              fields,
              model: config.model.modelName,
            });
            throw err;
          }
        })
      );
    }

    // Mount modelRouter for each model with IsAdmin permissions
    for (const config of modelConfigs) {
      const hiddenFieldSet = new Set(config.hiddenFields ?? []);
      const readonlySet = new Set(config.readonlyFields ?? []);
      const modelMeta = configModels.find((m) => m.name === config.model.modelName);
      const allowlist = new Set(modelMeta?.bulkPatchAllowlist ?? []);

      const adminPermission = (allowed: boolean | undefined): (typeof Permissions.IsAdmin)[] => {
        if (allowed === false) {
          return [];
        }
        return [Permissions.IsAdmin];
      };

      const stripProtectedFromBody = (body: unknown): Record<string, unknown> => {
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          return {};
        }
        const next = {...(body as Record<string, unknown>)};
        for (const key of readonlySet) {
          delete next[key];
        }
        for (const key of hiddenFieldSet) {
          delete next[key];
        }
        for (const key of SYSTEM_ADMIN_FIELDS) {
          delete next[key];
        }
        return next;
      };

      const bulkPatchOpenApi = openApiMw
        ? createOpenApiBuilder({openApi: openApiMw})
            .withTags(["admin"])
            .withSummary(`Bulk patch ${config.model.modelName} documents`)
            .withRequestBody<{ids: string[]; patch: Record<string, unknown>}>({
              ids: {
                description: "Document ids to update",
                items: {type: "string"},
                required: true,
                type: "array",
              },
              patch: {
                description: "Partial document; keys must be allowlisted for this model",
                required: true,
                type: "object",
              },
            })
            .withResponse(200, {
              failures: {type: "array"},
              updated: {type: "number"},
            })
            .build()
        : undefined;

      const auditEligible = Boolean(onAdminAudit) && config.model.modelName !== "AdminAuditLog";
      const auditHooks = auditEligible
        ? {
            postCreate: async (value: unknown, request: express.Request): Promise<void> => {
              const doc = auditDocumentToPlain(value);
              const rid = doc._id;
              await safeOnAdminAudit(request, {
                actorId: auditActorId(request),
                modelName: config.model.modelName,
                recordId: rid != null ? String(rid) : undefined,
                recordLabel: auditLabelFromListFields(doc, config.listFields),
                verb: "created",
              });
            },
            postDelete: async (request: express.Request, value: unknown): Promise<void> => {
              const doc = auditDocumentToPlain(value);
              const rid = doc._id;
              await safeOnAdminAudit(request, {
                actorId: auditActorId(request),
                modelName: config.model.modelName,
                recordId: rid != null ? String(rid) : undefined,
                recordLabel: auditLabelFromListFields(doc, config.listFields),
                verb: "deleted",
              });
            },
            postUpdate: async (
              value: unknown,
              _cleanedBody: unknown,
              request: express.Request,
              _prev: unknown
            ): Promise<void> => {
              const doc = auditDocumentToPlain(value);
              const rid = doc._id;
              await safeOnAdminAudit(request, {
                actorId: auditActorId(request),
                modelName: config.model.modelName,
                recordId: rid != null ? String(rid) : undefined,
                recordLabel: auditLabelFromListFields(doc, config.listFields),
                verb: "updated",
              });
            },
          }
        : {};

      // biome-ignore lint/suspicious/noExplicitAny: matches the Model<any> from AdminModelConfig above.
      const routerOptions: ModelRouterOptions<any> = {
        ...(openApiMw ? {openApi: openApiMw} : {}),
        defaultLimit: config.pageSize ?? 100,
        maxLimit: 500,
        permissions: {
          create: adminPermission(config.permissions?.create),
          delete: adminPermission(config.permissions?.delete),
          list: [Permissions.IsAdmin],
          read: [Permissions.IsAdmin],
          update: adminPermission(config.permissions?.update),
        },
        queryFields: buildAdminModelQueryFields({
          filters: config.filters,
          listDisplay: config.listDisplay,
          listFields: config.listFields,
          searchFields: config.searchFields,
        }),
        ...(config.queryFilter ? {queryFilter: config.queryFilter} : {}),
        preCreate: async (body, _req) => {
          if (!body || typeof body !== "object") {
            return body;
          }
          return stripProtectedFromBody(body) as typeof body;
        },
        preUpdate: async (body, _req) => {
          if (!body || typeof body !== "object") {
            return body;
          }
          return stripProtectedFromBody(body) as typeof body;
        },
        responseHandler:
          hiddenFieldSet.size > 0
            ? async (value, _method, _request, _options): Promise<JSONValue> =>
                removeHiddenFields(value, hiddenFieldSet) as JSONValue
            : undefined,
        sort: config.defaultSort ?? "-created",
        ...(config.populatePaths ? {populatePaths: config.populatePaths} : {}),
        ...auditHooks,
      };

      const modelBase = express.Router();
      modelBase.post(
        "/bulk-patch",
        authenticateMiddleware(),
        ...asMiddlewareList(bulkPatchOpenApi),
        asyncHandler(async (req, res) => {
          if (
            !(await checkPermissions("update", [Permissions.IsAdmin], req.user as User | undefined))
          ) {
            throw new APIError({status: 403, title: "Admin access required"});
          }
          if (config.permissions?.update === false) {
            throw new APIError({status: 403, title: "Updates are disabled for this model"});
          }
          const body = req.body as {ids?: unknown; patch?: unknown};
          if (!Array.isArray(body.ids)) {
            throw new APIError({status: 400, title: "Request body must include an ids array"});
          }
          if (typeof body.patch !== "object" || body.patch === null || Array.isArray(body.patch)) {
            throw new APIError({status: 400, title: "Request body must include a patch object"});
          }
          const ids = [...new Set(body.ids.map((id) => String(id)))];
          if (ids.length === 0) {
            throw new APIError({status: 400, title: "ids must include at least one id"});
          }
          if (ids.length > MAX_BULK_PATCH_IDS) {
            throw new APIError({
              status: 400,
              title: `At most ${MAX_BULK_PATCH_IDS} ids may be patched at once`,
            });
          }
          const rawPatch = body.patch as Record<string, unknown>;
          const unknownKeys = Object.keys(rawPatch).filter((key) => !allowlist.has(key));
          if (unknownKeys.length > 0) {
            throw new APIError({
              detail: unknownKeys.join(", "),
              status: 400,
              title: "Patch contains keys that are not allowlisted for bulk patch",
            });
          }
          const patch = stripProtectedFromBody(rawPatch);
          if (Object.keys(patch).length === 0) {
            throw new APIError({
              status: 400,
              title: "Patch must include at least one writable field",
            });
          }
          let updated = 0;
          const failures: {id: string; title: string}[] = [];
          for (const id of ids) {
            if (!mongoose.isValidObjectId(id)) {
              failures.push({id, title: "Invalid id"});
              continue;
            }
            try {
              const resUpdate = await config.model.updateOne({_id: id}, {$set: patch});
              if (resUpdate.matchedCount === 0) {
                failures.push({id, title: "Not found"});
              } else {
                updated += 1;
              }
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              failures.push({id, title: message});
            }
          }
          return res.json({failures: failures.length > 0 ? failures : undefined, updated});
        })
      );
      modelBase.use(modelRouter(config.model, routerOptions));

      app.use(`${basePath}${config.routePath}`, modelBase);
    }

    // Mount script routes
    if (scriptConfigs.length > 0) {
      const scriptsRouter = express.Router();
      scriptsRouter.use(authenticateMiddleware());

      this.mountScriptRoutes(scriptsRouter, scriptConfigs);

      app.use(`${basePath}/scripts`, scriptsRouter);
    }
  }

  /**
   * Registers the optional "create the first admin" bootstrap routes when
   * {@link AdminOptions.firstAdminSetup} is configured.
   *
   * @param onAudit - Shared `safeOnAdminAudit` from {@link register}, so a first-admin
   * claim shows up in the same `onAdminAudit` trail as other AdminApp mutations.
   */
  private registerFirstAdminSetupRoutes(
    app: express.Application,
    basePath: string,
    onAudit: (request: express.Request, event: AdminAuditEvent) => Promise<void>
  ): void {
    const setupConfig = this.options.firstAdminSetup;
    if (!setupConfig) {
      return;
    }
    const {userModel} = setupConfig;

    const isSetupNeeded = async (): Promise<boolean> => {
      if (process.env.ADMIN_SETUP_DISABLED === "true") {
        return false;
      }
      const adminCount = await userModel.countDocuments({admin: true});
      return adminCount === 0;
    };

    // GET /admin/setup-status — public, so an anonymous first-run visitor can detect
    // whether to show the setup flow before signing in.
    app.get(
      `${basePath}/setup-status`,
      asyncHandler(async (_req, res) => {
        return res.json({needsSetup: await isSetupNeeded()});
      })
    );

    // POST /admin/setup-claim — promotes the calling (already authenticated) user to
    // admin. Only succeeds while no admin user exists yet. This is a best-effort race
    // guard (re-checked immediately before writing) rather than a hard atomic guarantee
    // across documents, which is unnecessary for a one-time bootstrap flow.
    app.post(
      `${basePath}/setup-claim`,
      authenticateMiddleware(),
      asyncHandler(async (req, res) => {
        if (!(await isSetupNeeded())) {
          throw new APIError({status: 403, title: "An admin user already exists"});
        }
        const user = req.user as {_id?: unknown; email?: string; name?: string} | undefined;
        if (!user?._id) {
          throw new APIError({status: 401, title: "Sign in before claiming admin access"});
        }
        const result = await userModel.updateOne({_id: user._id}, {$set: {admin: true}});
        if (result.matchedCount === 0) {
          throw new APIError({status: 404, title: "User not found"});
        }
        const userId = String(user._id);
        logger.info(`Claimed first admin via setup flow: ${userId}`);
        await onAudit(req, {
          actorId: userId,
          modelName: userModel.modelName,
          recordId: userId,
          recordLabel: user.name ?? user.email,
          verb: "updated",
        });
        return res.status(200).json({admin: true});
      })
    );
  }

  private mountScriptRoutes(router: express.Router, scripts: AdminScriptConfig[]): void {
    const scriptsByName = new Map(scripts.map((s) => [s.name, s]));
    const scriptNames = scripts.map((s) => s.name);

    // GET /admin/scripts/runs — Paginated history of script runs (BackgroundTasks)
    router.get(
      "/runs",
      asyncHandler(async (req: express.Request, res: express.Response) => {
        const user = req.user as {admin?: boolean} | undefined;
        if (!user?.admin) {
          throw new APIError({status: 403, title: "Only admins can view run history"});
        }

        const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const skip = (page - 1) * limit;

        // Scope history to currently-registered scripts. An optional `name` query
        // narrows to a single script (used by the per-script "History" link). A
        // provided-but-unregistered name resolves to an empty filter so callers can
        // distinguish "unknown script" (no runs) from "show all".
        const requestedName = typeof req.query.name === "string" ? req.query.name : undefined;
        let taskTypeFilter: string[];
        if (requestedName !== undefined) {
          taskTypeFilter = scriptNames.includes(requestedName) ? [requestedName] : [];
        } else {
          taskTypeFilter = scriptNames;
        }

        const query =
          taskTypeFilter.length > 0
            ? {taskType: {$in: taskTypeFilter}}
            : {taskType: {$in: [] as string[]}};

        const [tasks, total] = await Promise.all([
          BackgroundTask.find(query)
            .sort({created: -1})
            .skip(skip)
            .limit(limit)
            .populate({path: "createdBy", select: "name email"})
            .lean(),
          BackgroundTask.countDocuments(query),
        ]);

        const data = tasks.map((task) => {
          const createdBy = task.createdBy as unknown as
            | {name?: string; email?: string}
            | mongoose.Types.ObjectId
            | undefined;
          const createdByName =
            createdBy &&
            typeof createdBy === "object" &&
            !(createdBy instanceof mongoose.Types.ObjectId)
              ? (createdBy.name ?? createdBy.email)
              : undefined;
          return {...task, createdByName};
        });

        return res.json({data, limit, more: skip + tasks.length < total, page, total});
      })
    );

    // POST /admin/scripts/:name/run — Execute a script
    router.post(
      "/:name/run",
      asyncHandler(async (req: express.Request<{name: string}>, res: express.Response) => {
        const user = req.user as {_id: unknown; admin?: boolean; name?: string} | undefined;
        if (!user?.admin) {
          throw new APIError({status: 403, title: "Only admins can run scripts"});
        }

        const script = scriptsByName.get(req.params.name);
        if (!script) {
          throw new APIError({status: 404, title: `Script not found: ${req.params.name}`});
        }

        const isWetRun = req.query.wetRun === "true";

        // Collect flexible arguments from the request. Query params and a JSON body
        // are both accepted; an explicit `args` object in the body takes precedence.
        // Reserved runner flags (wetRun, wet, dry, json, ...) are stripped so scripts
        // read args identically over HTTP and via the CLI.
        const argValues: Record<string, ScriptArgValue> = {};
        for (const [key, value] of Object.entries(req.query)) {
          if (RESERVED_SCRIPT_FLAGS.includes(key) || value === undefined) {
            continue;
          }
          argValues[key] = value as ScriptArgValue;
        }
        const rawBody =
          req.body && typeof req.body === "object" && !Array.isArray(req.body)
            ? (req.body as Record<string, unknown>)
            : {};
        const bodyValues =
          rawBody.args && typeof rawBody.args === "object" && !Array.isArray(rawBody.args)
            ? (rawBody.args as Record<string, ScriptArgValue>)
            : (rawBody as Record<string, ScriptArgValue>);
        for (const [key, value] of Object.entries(bodyValues)) {
          if (RESERVED_SCRIPT_FLAGS.includes(key)) {
            continue;
          }
          argValues[key] = value;
        }

        const {args, errors: argErrors} = createScriptArgs({
          defs: script.args ?? [],
          values: argValues,
        });
        if (argErrors.length > 0) {
          throw new APIError({
            detail: argErrors.join("; "),
            status: 400,
            title: `Invalid arguments for script: ${script.name}`,
          });
        }

        const now = DateTime.now().toJSDate();

        let task: BackgroundTaskDocument;
        try {
          task = (await BackgroundTask.create({
            createdBy: user._id as mongoose.Types.ObjectId,
            isDryRun: !isWetRun,
            logs: [
              {level: "info", message: `Script started by ${user.name ?? "admin"}`, timestamp: now},
            ],
            progress: {message: "Starting...", percentage: 0, stage: "Queued"},
            startedAt: now,
            status: "running",
            taskType: script.name,
          })) as BackgroundTaskDocument;
        } catch (err: unknown) {
          const detail = err instanceof Error ? err.message : String(err);
          logger.error(`Failed to create background task for ${script.name}: ${detail}`);
          throw new APIError({
            detail,
            status: 500,
            title: `Failed to create background task for script: ${script.name}`,
          });
        }

        // Build context for cancellation, progress reporting, and arguments
        const ctx: ScriptContext = {
          addLog: async (level, message) => {
            const current = await BackgroundTask.findById(task._id);
            if (current) {
              await current.addLog(level, message);
            }
          },
          args,
          checkCancellation: async () => {
            await BackgroundTask.checkCancellation(task._id.toString());
          },
          updateProgress: async (percentage, stage, message) => {
            const current = await BackgroundTask.findById(task._id);
            if (current) {
              await current.updateProgress(percentage, stage, message);
            }
          },
        };

        // Run the script asynchronously — use atomic updates to avoid overwriting
        // cancellation or other intermediate state changes.
        void (async () => {
          try {
            const result: ScriptResult = await script.runner(isWetRun, ctx);

            // Atomically update only if still running (don't overwrite cancellation)
            await BackgroundTask.findOneAndUpdate(
              {_id: task._id, status: "running"},
              {
                $set: {
                  completedAt: DateTime.now().toJSDate(),
                  progress: {message: "Done", percentage: 100, stage: "Complete"},
                  result: result.results,
                  status: result.success ? "completed" : "failed",
                },
              }
            );
          } catch (err: unknown) {
            if (err instanceof TaskCancelledError) {
              return;
            }
            const message = err instanceof Error ? err.message : String(err);
            logger.error(`Script ${script.name} failed: ${message}`);

            // Atomically update only if still running
            await BackgroundTask.findOneAndUpdate(
              {_id: task._id, status: "running"},
              {
                $set: {
                  completedAt: DateTime.now().toJSDate(),
                  error: message,
                  result: [message],
                  status: "failed",
                },
              }
            );
          }
        })();

        return res.status(201).json({taskId: task._id.toString()});
      })
    );

    // GET /admin/scripts/tasks/:id — Poll task status
    router.get(
      "/tasks/:id",
      asyncHandler(async (req: express.Request<{id: string}>, res: express.Response) => {
        const user = req.user as {_id: unknown; admin?: boolean} | undefined;
        if (!user?.admin) {
          throw new APIError({status: 403, title: "Only admins can view tasks"});
        }

        let task: BackgroundTaskDocument | null;
        try {
          task = await BackgroundTask.findById(req.params.id);
        } catch (err: unknown) {
          const detail = err instanceof Error ? err.message : String(err);
          throw new APIError({detail, status: 400, title: "Invalid task ID"});
        }
        if (!task) {
          throw new APIError({status: 404, title: "Task not found"});
        }

        return res.json({task: task.toObject()});
      })
    );

    // DELETE /admin/scripts/tasks/:id — Cancel a running task
    router.delete(
      "/tasks/:id",
      asyncHandler(async (req: express.Request<{id: string}>, res: express.Response) => {
        const user = req.user as {_id: unknown; admin?: boolean; name?: string} | undefined;
        if (!user?.admin) {
          throw new APIError({status: 403, title: "Only admins can cancel tasks"});
        }

        let task: BackgroundTaskDocument | null;
        try {
          task = await BackgroundTask.findById(req.params.id);
        } catch (err: unknown) {
          const detail = err instanceof Error ? err.message : String(err);
          throw new APIError({detail, status: 400, title: "Invalid task ID"});
        }
        if (!task) {
          throw new APIError({status: 404, title: "Task not found"});
        }

        if (task.status !== "pending" && task.status !== "running") {
          throw new APIError({
            status: 400,
            title: `Cannot cancel task with status: ${task.status}`,
          });
        }

        // Atomically cancel only if still running/pending (avoids race with completion)
        const cancelled = await BackgroundTask.findOneAndUpdate(
          {_id: task._id, status: {$in: ["pending", "running"]}},
          {
            $push: {
              logs: {
                level: "info",
                message: `Task cancelled by ${user.name ?? "admin"}`,
                timestamp: DateTime.now().toJSDate(),
              },
            },
            $set: {
              completedAt: DateTime.now().toJSDate(),
              status: "cancelled",
            },
          },
          {new: true}
        );

        if (!cancelled) {
          throw new APIError({
            status: 409,
            title: "Task already completed or cancelled",
          });
        }

        return res.json({message: "Task cancelled", task: cancelled.toObject()});
      })
    );
  }
}
