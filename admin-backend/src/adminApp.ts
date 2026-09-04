import {
  ADMIN_PAGE_ACTION,
  type AdminAccessConfig,
  type AdminModelAdminMap,
  type AnyTerrenoAccess,
  APIError,
  asyncHandler,
  authenticateMiddleware,
  BackgroundTask,
  type BackgroundTaskDocument,
  checkPermissions,
  createOpenApiBuilder,
  createScriptArgs,
  describeModel,
  type JSONValue,
  logger,
  type ModelRouterOptions,
  modelDescriptionToAdminFields,
  modelRouter,
  type OpenApiMiddleware,
  type PermissionMethod,
  Permissions,
  type PopulatePath,
  type ScriptArgDef,
  type ScriptArgValue,
  type ScriptContext,
  type ScriptResult,
  type ScriptRunner,
  scrubAdminFields,
  TaskCancelledError,
  type TerrenoApp,
  type User,
  VersionConfig,
} from "@terreno/api";
import express from "express";
import {DateTime} from "luxon";
import type {Model} from "mongoose";
import mongoose from "mongoose";
import {assignUniqueAdminConfigNames, findAdminModelMetaByRoutePath} from "./adminConfigIdentity";
import {
  ADMIN_LIST_SEARCH_PARAM,
  andMongoFilters,
  buildAdminPartialSearchFilter,
} from "./adminTextSearch";
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
import {aggregateFromTerrenoApp} from "./aggregateAdmin";
import {parseAdminListFilters} from "./filterParser";
import type {ResolvedAdminModel} from "./resolvedAdminModel";
import {RESERVED_SCRIPT_FLAGS} from "./scriptCli";

/**
 * Configuration for a single model in the admin panel.
 */
export interface AdminFieldOverride {
  /** Widget to use for this field in the admin form (e.g., "markdown") */
  widget?: string;
}

/**
 * Builds an ownership check for writeOwned admin access. The field may contain an id
 * directly or a populated document with `_id`.
 */
export const adminOwnedBy = (field: string): NonNullable<AdminAccessConfig["isOwned"]> => {
  return ({instance, user}): boolean => {
    const value = (instance as Record<string, unknown> | undefined)?.[field];
    const ownerId = (value as {_id?: unknown} | undefined)?._id ?? value;
    return ownerId != null && String(ownerId) === String(user.id);
  };
};

export interface AdminModelConfig {
  /** The Mongoose model to expose in the admin panel */
  // noExplicitAny: Model<T> is invariant; the admin panel must accept any document shape.
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
  /** Fine-grained admin RBAC and optional ownership/custom authorization. */
  adminAccess?: AdminAccessConfig;
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
  /** Sidebar heading. Screens without a group stay under "Screens". */
  group?: string;
  icon?: string;
  /** RBAC or custom authorization for exposing this screen in admin metadata/navigation. */
  adminAccess?: Pick<AdminAccessConfig, "authorize" | "resource"> & {action?: string};
}

/**
 * Configuration options for the AdminApp plugin.
 */
export interface AdminOptions {
  /** Legacy model configurations (deprecated — prefer modelRouter `admin:` or plugin contributions). */
  models?: AdminModelConfig[];
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
  /** When set, admin shell entry requires `admin:access`; model CRUD also requires
   * resource/action permissions (for example `user:update`) from the same Access instance. */
  accessControl?: AnyTerrenoAccess;
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
  capabilities: {
    actions: boolean;
    fieldsets: boolean;
    filters: boolean;
    realtime: boolean;
  };
  customScreens?: AdminCustomScreenConfig[];
  home: ReturnType<typeof normalizeAdminHome>;
  models: AdminModelMeta[];
  platformTools: {
    configuration: boolean;
    roles: boolean;
    runScripts: boolean;
    scripts: boolean;
    version: boolean;
    viewScripts: boolean;
  };
  schemaVersion: number;
  scripts: AdminScriptMeta[];
  widgetIds: string[];
}

const buildAllModelAdminsMap = (models: ResolvedAdminModel[]): AdminModelAdminMap => {
  const map: AdminModelAdminMap = {};
  for (const config of models) {
    map[config.model.modelName] = config.admin;
  }
  return map;
};

const scrubAdminResponse = (
  value: unknown,
  config: ResolvedAdminModel,
  allModelAdmins: AdminModelAdminMap
): unknown => {
  return scrubAdminFields(value, {
    admin: config.admin,
    allModelAdmins,
    schema: config.model.schema,
  });
};

const buildAdminListQueryFilter = (
  config: ResolvedAdminModel,
  /** Resolved (possibly derived) search fields from `/admin/config`, not just explicit config. */
  resolvedSearchFields?: string[]
): NonNullable<ModelRouterOptions<unknown>["queryFilter"]> => {
  const base = config.queryFilter;
  const searchFields = resolvedSearchFields ?? config.searchFields ?? [];
  return async (user, query) => {
    const clientQuery: Record<string, unknown> = {...(query ?? {})};
    const {consumedKeys, errors, filter} = parseAdminListFilters(clientQuery, config.filters ?? []);
    if (Object.keys(errors).length > 0) {
      throw new APIError({
        detail: JSON.stringify(errors),
        status: 400,
        title: "Invalid filter",
      });
    }
    for (const key of consumedKeys) {
      delete clientQuery[key];
    }

    const rawSearch = clientQuery[ADMIN_LIST_SEARCH_PARAM];
    delete clientQuery[ADMIN_LIST_SEARCH_PARAM];
    const searchClause =
      typeof rawSearch === "string"
        ? buildAdminPartialSearchFilter({
            model: config.model,
            q: rawSearch,
            searchFields,
          })
        : undefined;

    let merged: Record<string, unknown> = {...clientQuery, ...filter};
    if (base) {
      const baseResult = await base(user, merged);
      if (baseResult === null) {
        return null;
      }
      merged = {...merged, ...baseResult};
    }
    const result = andMongoFilters(merged, searchClause);
    return {...result, [ADMIN_LIST_SEARCH_PARAM]: undefined};
  };
};

const ADMIN_TIMESTAMP_SORT_FIELDS = ["created", "createdAt", "updated", "updatedAt"];

const sortTokensToFields = (sort: string | string[] | undefined): string[] => {
  if (!sort) {
    return [];
  }
  const raw = Array.isArray(sort) ? sort.join(" ") : sort;
  return raw
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^-/, ""))
    .filter((field) => field.length > 0);
};

const resolveAdminSortableFields = ({
  defaultSort,
  listDisplay,
  sortableFields,
}: {
  defaultSort?: string | string[];
  listDisplay: string[];
  sortableFields?: string[];
}): string[] => {
  return [
    ...new Set([
      ...(sortableFields ?? listDisplay),
      "_id",
      ...ADMIN_TIMESTAMP_SORT_FIELDS,
      ...sortTokensToFields(defaultSort),
    ]),
  ];
};

const validateAdminSortParam =
  (sortableFields: string[]): express.RequestHandler =>
  (req, _res, next) => {
    const sort = req.query.sort;
    if (typeof sort !== "string" || !sort.trim()) {
      next();
      return;
    }
    const tokens = sort.trim().split(/\s+/);
    for (const token of tokens) {
      const field = token.replace(/^-/, "");
      if (!sortableFields.includes(field)) {
        throw new APIError({
          detail: field,
          status: 400,
          title: "Invalid sort field",
        });
      }
    }
    next();
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

const coerceAdminFlag = (value: unknown): boolean => {
  if (value === true || value === 1 || value === "1" || value === "true" || value === "yes") {
    return true;
  }
  if (
    value === false ||
    value === 0 ||
    value === "0" ||
    value === "false" ||
    value === "no" ||
    value === "" ||
    value == null
  ) {
    return false;
  }
  throw new APIError({status: 400, title: "admin must be a boolean"});
};

const auditActorId = (request: express.Request): string | undefined => {
  const user = request.user as {_id?: unknown} | undefined;
  if (!user || user._id == null) {
    return undefined;
  }
  return String(user._id);
};

interface ArraySchemaTypeCompatibility {
  caster?: mongoose.SchemaType;
  getEmbeddedSchemaType?: () => mongoose.SchemaType | undefined;
}

export const getArrayEmbeddedSchemaType = (
  schemaPath: mongoose.SchemaType
): mongoose.SchemaType | undefined => {
  const compatiblePath = schemaPath as mongoose.SchemaType & ArraySchemaTypeCompatibility;
  if (typeof compatiblePath.getEmbeddedSchemaType === "function") {
    return compatiblePath.getEmbeddedSchemaType();
  }
  return compatiblePath.caster;
};

const extractFieldMetaFromDescription = (
  model: Model<unknown>,
  hiddenFields: string[]
): Record<string, AdminFieldMeta> => {
  const hiddenFieldSet = new Set(hiddenFields);
  const description = describeModel(model);
  const fields = modelDescriptionToAdminFields(description);
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !hiddenFieldSet.has(key)));
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

  private adminAccessPermissions(): PermissionMethod<unknown>[] {
    if (this.options.accessControl) {
      return [this.options.accessControl.permission({admin: [ADMIN_PAGE_ACTION]})];
    }
    return [Permissions.IsAdmin];
  }

  private async hasScriptPermission(
    user: User | undefined,
    action: "runScripts" | "viewBackgroundTasks"
  ): Promise<boolean> {
    if (!this.options.accessControl) {
      return Boolean(user?.admin);
    }
    const result = await this.options.accessControl.can({
      permissions: {admin: [action]},
      user,
    });
    return result.allowed;
  }

  private async hasConfigurationPermission(
    user: User | undefined,
    action: "read" | "update"
  ): Promise<boolean> {
    if (!this.options.accessControl) {
      return Boolean(user?.admin);
    }
    const result = await this.options.accessControl.can({
      permissions: {configuration: [action]},
      user,
    });
    return result.allowed;
  }

  private async canAnyResourceAction(
    user: User | undefined,
    resource: string,
    actions: string[],
    instance?: unknown
  ): Promise<boolean> {
    const accessControl = this.options.accessControl;
    if (!accessControl || !user) {
      return Boolean(user?.admin);
    }
    for (const action of actions) {
      const result = await accessControl.can({
        doc: instance,
        permissions: {[resource]: [action]},
        user,
      });
      if (result.allowed) {
        return true;
      }
    }
    return false;
  }

  private adminResource(config: Pick<AdminModelConfig, "adminAccess" | "model">): string {
    const accessControl = this.options.accessControl;
    const explicit = config.adminAccess?.resource;
    if (explicit) {
      return explicit;
    }
    const standard = `admin${config.model.modelName}`;
    if (accessControl?.statements[standard]) {
      return standard;
    }
    return `${config.model.modelName.charAt(0).toLowerCase()}${config.model.modelName.slice(1)}`;
  }

  private async isAdminModelOwned(
    config: Pick<AdminModelConfig, "adminAccess">,
    user: User,
    instance: unknown
  ): Promise<boolean> {
    if (config.adminAccess?.isOwned) {
      return config.adminAccess.isOwned({instance, user});
    }
    const owner = (instance as {ownerId?: {_id?: unknown} | unknown} | undefined)?.ownerId;
    const ownerId = (owner as {_id?: unknown} | undefined)?._id ?? owner;
    return ownerId != null && String(ownerId) === String(user.id);
  }

  private resourceActionPermissions(
    config: Pick<AdminModelConfig, "adminAccess" | "model">,
    action: "list" | "read" | "create" | "update" | "delete"
  ): PermissionMethod<unknown>[] {
    const shell = this.adminAccessPermissions();
    const accessControl = this.options.accessControl;
    if (!accessControl) {
      return shell;
    }
    if (config.adminAccess?.authorize) {
      return [
        ...shell,
        async (_method, user, instance) =>
          config.adminAccess?.authorize?.({action, instance, user}) ?? false,
      ];
    }
    const resource = this.adminResource(config);
    const knownActions = accessControl.statements[resource];
    if (!knownActions) {
      return [];
    }
    const hasStandardAccess = knownActions.includes("write") || knownActions.includes("writeOwned");
    if (hasStandardAccess) {
      return [
        ...shell,
        async (_method, user, instance) => {
          if (!user) {
            return false;
          }
          if (action === "list" || action === "read") {
            return this.canAnyResourceAction(user, resource, ["read"], instance);
          }
          if (await this.canAnyResourceAction(user, resource, ["write"], instance)) {
            return true;
          }
          if (!(await this.canAnyResourceAction(user, resource, ["writeOwned"], instance))) {
            return false;
          }
          // writeOwned always allows create. Ownership applies to update/delete.
          if (action === "create" || instance === undefined) {
            return true;
          }
          return this.isAdminModelOwned(config, user, instance);
        },
      ];
    }
    return [...shell, accessControl.permission({[resource]: [action]})];
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
  register(app: express.Application, openApi?: unknown, terrenoApp?: TerrenoApp): void {
    const basePath = this.options.basePath ?? "/admin";
    const openApiMw = openApi as OpenApiMiddleware | undefined;
    const aggregated = aggregateFromTerrenoApp({
      legacyModels: this.options.models ?? [],
      terrenoApp,
    });
    const modelConfigs = aggregated.models;
    const allModelAdmins = buildAllModelAdminsMap(modelConfigs);
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

    // Build config response with field metadata from Mongoose schemas
    const configNames = assignUniqueAdminConfigNames(
      modelConfigs.map((config) => ({
        modelName: config.model.modelName,
        routePath: config.routePath,
        source: config.source,
      }))
    );
    const configModels: AdminModelMeta[] = modelConfigs.map((config, configIndex) => {
      const hiddenFieldSet = new Set(config.hiddenFields ?? []);
      const fields = extractFieldMetaFromDescription(config.model, [...hiddenFieldSet]);

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
      const sortableFields = resolveAdminSortableFields({
        defaultSort: config.defaultSort,
        listDisplay,
        sortableFields: config.sortableFields,
      });
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
        name: configNames[configIndex] ?? config.model.modelName,
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
    const scriptConfigs = [...(this.options.scripts ?? []), ...aggregated.scripts];
    const configScripts: AdminScriptMeta[] = scriptConfigs.map((script) => ({
      args: script.args ?? [],
      description: script.description,
      name: script.name,
    }));

    const mergedScreens: AdminCustomScreenConfig[] = [
      ...aggregated.customScreens,
      ...(this.options.customScreens ?? []),
    ];

    const baseConfigResponse: AdminConfigResponse = {
      capabilities: {
        actions: true,
        fieldsets: true,
        filters: true,
        realtime: modelConfigs.some((config) => config.realtime === true),
      },
      customScreens: mergedScreens,
      home: normalizeAdminHome(this.options.home),
      models: configModels,
      platformTools: {
        configuration: true,
        roles: true,
        runScripts: true,
        scripts: true,
        version: true,
        viewScripts: true,
      },
      schemaVersion: ADMIN_SCHEMA_VERSION,
      scripts: configScripts,
      widgetIds: aggregated.widgetIds,
    };

    const buildAuthorizedConfig = async (user: User | undefined): Promise<AdminConfigResponse> => {
      const authorizedModels = (
        await Promise.all(
          configModels.map(async (modelMeta, index): Promise<AdminModelMeta | null> => {
            const config = modelConfigs[index];
            if (!config) {
              return null;
            }
            const canRead = await checkPermissions(
              "list",
              this.resourceActionPermissions(config, "list"),
              user
            );
            if (!canRead) {
              return null;
            }
            const canCreate =
              modelMeta.permissions.create &&
              (await checkPermissions(
                "create",
                this.resourceActionPermissions(config, "create"),
                user
              ));
            const canDelete =
              modelMeta.permissions.delete &&
              (await checkPermissions(
                "delete",
                this.resourceActionPermissions(config, "delete"),
                user
              ));
            const canUpdate =
              modelMeta.permissions.update &&
              (await checkPermissions(
                "update",
                this.resourceActionPermissions(config, "update"),
                user
              ));
            return {
              ...modelMeta,
              permissions: {create: canCreate, delete: canDelete, update: canUpdate},
            };
          })
        )
      ).filter((model): model is AdminModelMeta => model !== null);

      const authorizedScreens = (
        await Promise.all(
          mergedScreens.map(async (screen): Promise<AdminCustomScreenConfig | null> => {
            if (!screen.adminAccess) {
              return screen;
            }
            if (screen.adminAccess.authorize) {
              const allowed = await screen.adminAccess.authorize({
                action: screen.adminAccess.action ?? "read",
                user,
              });
              return allowed ? screen : null;
            }
            if (!screen.adminAccess.resource) {
              return screen;
            }
            const allowed = await this.canAnyResourceAction(user, screen.adminAccess.resource, [
              screen.adminAccess.action ?? "read",
            ]);
            return allowed ? screen : null;
          })
        )
      ).filter((screen): screen is AdminCustomScreenConfig => screen !== null);

      const canReadConfiguration = await this.hasConfigurationPermission(user, "read");
      const canReadRoles = await this.canAnyResourceAction(user, "rbac", ["read"]);
      const canRunScripts = await this.hasScriptPermission(user, "runScripts");
      const canViewScripts = await this.hasScriptPermission(user, "viewBackgroundTasks");
      const canUseScripts = canRunScripts || canViewScripts;
      return {
        ...baseConfigResponse,
        customScreens: authorizedScreens.map(({adminAccess: _adminAccess, ...screen}) => screen),
        models: authorizedModels,
        platformTools: {
          configuration: canReadConfiguration,
          roles: canReadRoles,
          runScripts: canRunScripts,
          scripts: canUseScripts,
          version: canReadConfiguration,
          viewScripts: canViewScripts,
        },
        scripts: canUseScripts ? configScripts : [],
      };
    };

    const adminConfigOpenApi = openApiMw
      ? createOpenApiBuilder({openApi: openApiMw})
          .withTags(["admin"])
          .withSummary("Admin panel configuration")
          .withResponse(200, {
            capabilities: {
              properties: {
                actions: {type: "boolean"},
                fieldsets: {type: "boolean"},
                filters: {type: "boolean"},
                realtime: {type: "boolean"},
              },
              type: "object",
            },
            customScreens: {
              items: {
                properties: {
                  description: {type: "string"},
                  displayName: {type: "string"},
                  group: {type: "string"},
                  icon: {type: "string"},
                  name: {type: "string"},
                },
                type: "object",
              },
              type: "array",
            },
            home: {type: "object"},
            models: {type: "array"},
            platformTools: {
              properties: {
                configuration: {type: "boolean"},
                roles: {type: "boolean"},
                runScripts: {type: "boolean"},
                scripts: {type: "boolean"},
                version: {type: "boolean"},
                viewScripts: {type: "boolean"},
              },
              type: "object",
            },
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
            widgetIds: {items: {type: "string"}, type: "array"},
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
          !(await checkPermissions(
            "read",
            this.adminAccessPermissions(),
            req.user as User | undefined
          ))
        ) {
          throw new APIError({status: 403, title: "Admin access required"});
        }
        return res.json(await buildAuthorizedConfig(req.user as User | undefined));
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
        const actor = req.user as User | undefined;
        if (!actor || !(await this.hasScriptPermission(actor, "runScripts"))) {
          throw new APIError({status: 403, title: "Admin access required"});
        }
        const user = actor as {_id: unknown};
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
        if (!(await this.hasConfigurationPermission(req.user as User | undefined, "read"))) {
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
        if (!(await this.hasConfigurationPermission(req.user as User | undefined, "update"))) {
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
          returnDocument: "after",
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
      const modelMeta = findAdminModelMetaByRoutePath(
        configModels,
        `${basePath}${config.routePath}`
      );
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
          if (
            !(await checkPermissions(
              "list",
              this.resourceActionPermissions(config, "list"),
              req.user as User | undefined
            ))
          ) {
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

          const fields =
            typeof req.query.fields === "string"
              ? req.query.fields.split(",").filter((f: string) => searchableFields.includes(f))
              : searchableFields;

          const searchClause = buildAdminPartialSearchFilter({
            extraObjectIdFields: objectIdFields,
            model: config.model,
            q,
            searchFields: fields,
          });

          if (!searchClause) {
            return res.json({data: []});
          }
          logger.debug("Admin search query", {
            fields,
            model: config.model.modelName,
            q,
          });
          try {
            const scoped = await buildAdminListQueryFilter(config, modelMeta?.searchFields)(
              req.user as User | undefined,
              {}
            );
            if (scoped === null) {
              return res.json({data: []});
            }
            const results = await config.model
              .find({$and: [scoped, searchClause]})
              .limit(20)
              .lean();
            logger.debug("Admin search results", {
              count: results.length,
              model: config.model.modelName,
            });
            return res.json({
              data: results.map((doc) => scrubAdminResponse(doc, config, allModelAdmins)),
            });
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
      const excludeFieldSet = new Set(config.excludeFields ?? []);
      const modelMeta = findAdminModelMetaByRoutePath(
        configModels,
        `${basePath}${config.routePath}`
      );
      const allowlist = new Set(modelMeta?.bulkPatchAllowlist ?? []);

      const adminPermission = (
        allowed: boolean | undefined,
        action: "list" | "read" | "create" | "update" | "delete"
      ): PermissionMethod<unknown>[] => {
        if (allowed === false) {
          return [];
        }
        return this.resourceActionPermissions(config, action);
      };

      const updatePermissions = this.resourceActionPermissions(config, "update");

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
        for (const key of excludeFieldSet) {
          delete next[key];
        }
        for (const key of SYSTEM_ADMIN_FIELDS) {
          delete next[key];
        }
        // Self-service never writes these fields. Admin CRUD may set `admin`.
        // When RBAC is enabled, `roles` must go through RoleManager.assign and
        // tenant membership is not a generic User document field.
        if (config.model.modelName === "User" && this.options.accessControl) {
          delete next.organizationIds;
          delete next.roles;
        }
        return next;
      };

      const parseRoleNames = (value: unknown): string[] => {
        if (!Array.isArray(value) || value.some((roleName) => typeof roleName !== "string")) {
          throw new APIError({status: 400, title: "roles must be an array of strings"});
        }
        return value as string[];
      };

      const takePendingUserRoles = (
        body: Record<string, unknown>,
        request: express.Request
      ): void => {
        if (config.model.modelName !== "User" || !this.options.accessControl) {
          return;
        }
        if (!("roles" in body)) {
          return;
        }
        (
          request as express.Request & {terrenoPendingUserRoles?: string[]}
        ).terrenoPendingUserRoles = parseRoleNames(body.roles);
      };

      const applyPendingUserRoles = async (
        value: unknown,
        request: express.Request,
        rollbackOnFailure = false
      ): Promise<void> => {
        const pending = (request as express.Request & {terrenoPendingUserRoles?: string[]})
          .terrenoPendingUserRoles;
        if (!pending) {
          return;
        }
        const actor = request.user as User | undefined;
        const accessControl = this.options.accessControl;
        if (!actor || !accessControl) {
          throw new APIError({status: 401, title: "Unauthorized"});
        }
        const record = value as {
          _id?: unknown;
          id?: string;
          roles?: string[];
          set?: (path: string, value: unknown) => void;
        };
        const userId = record.id ?? (record._id != null ? String(record._id) : undefined);
        if (!userId) {
          throw new APIError({status: 500, title: "User id missing after write"});
        }
        try {
          await accessControl.roles.assign({actor, roleNames: pending, userId});
          if (typeof record.set === "function") {
            record.set("roles", [...pending]);
          } else {
            record.roles = [...pending];
          }
        } catch (error) {
          if (rollbackOnFailure) {
            try {
              await config.model.deleteOne({_id: userId});
            } catch (rollbackError) {
              logger.error("Failed to roll back user after role assignment failure", {
                error: rollbackError,
                userId,
              });
            }
          }
          throw error;
        }
      };

      const restoreUserFieldsAfterFailedRoleAssign = async (
        value: unknown,
        prev: unknown,
        cleanedBody: unknown
      ): Promise<void> => {
        if (!prev || typeof prev !== "object" || !cleanedBody || typeof cleanedBody !== "object") {
          return;
        }
        if (Array.isArray(cleanedBody)) {
          return;
        }
        const record = value as {
          _id?: unknown;
          save?: () => Promise<unknown>;
          set?: (path: string, next: unknown) => void;
        };
        const prevRecord = prev as Record<string, unknown>;
        const body = cleanedBody as Record<string, unknown>;
        const restore: Record<string, unknown> = {};
        for (const key of Object.keys(body)) {
          if (key === "roles") {
            continue;
          }
          restore[key] = prevRecord[key];
          if (typeof record.set === "function") {
            record.set(key, prevRecord[key]);
          }
        }
        if (Object.keys(restore).length === 0) {
          return;
        }
        if (typeof record.save === "function") {
          await record.save();
          return;
        }
        if (record._id != null) {
          await config.model.updateOne({_id: record._id}, {$set: restore});
        }
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

      const assertCanWriteUserAdminFlag = async (
        body: Record<string, unknown>,
        request: express.Request,
        currentAdmin = false,
        targetUserId?: string
      ): Promise<void> => {
        if (config.model.modelName !== "User" || !("admin" in body)) {
          return;
        }
        const accessControl = this.options.accessControl;
        if (!accessControl) {
          return;
        }
        if (coerceAdminFlag(body.admin) === Boolean(currentAdmin)) {
          return;
        }
        const actor = request.user as User | undefined;
        if (!actor) {
          throw new APIError({status: 401, title: "Unauthorized"});
        }
        const result = await accessControl.can({
          permissions: {rbac: ["assignRoles"]},
          user: actor,
        });
        if (!result.allowed) {
          throw new APIError({
            status: 403,
            title: "Missing rbac:assignRoles permission",
          });
        }
        const nextAdmin = coerceAdminFlag(body.admin);
        const isGrantingAdmin = nextAdmin === true && !currentAdmin;
        const isRevokingAdmin = nextAdmin === false && currentAdmin;
        // assignRoles and manageRoles still cannot mint or strip the legacy admin
        // plane (IsAdmin, password reset, owner bypass). Only an existing admin can.
        if ((isGrantingAdmin || isRevokingAdmin) && !actor.admin) {
          throw new APIError({
            status: 403,
            title: isGrantingAdmin
              ? "Cannot grant the legacy admin flag without the admin privilege"
              : "Cannot revoke the legacy admin flag without the admin privilege",
          });
        }
        const targetId = targetUserId ?? request.params?.id;
        if (targetId) {
          await accessControl.roles.assertCanModifyUser({actor, userId: String(targetId)});
        }
      };

      const currentUserAdminFlag = async (request: express.Request): Promise<boolean> => {
        const id = request.params?.id;
        if (!id) {
          return false;
        }
        const existing = await config.model.findById(id).select("admin").lean();
        return Boolean((existing as {admin?: boolean} | null)?.admin);
      };

      const markAuthorizedUserAdminWrite = (
        body: Record<string, unknown>,
        request: express.Request
      ): void => {
        if (
          config.model.modelName !== "User" ||
          !this.options.accessControl ||
          !("admin" in body)
        ) {
          return;
        }
        (
          request as express.Request & {terrenoAllowUserAdminWrite?: boolean}
        ).terrenoAllowUserAdminWrite = true;
      };

      const addRecordCapabilities = async (
        value: unknown,
        request: express.Request
      ): Promise<JSONValue> => {
        const scrubbed = scrubAdminResponse(value, config, allModelAdmins);
        const sourceItems = Array.isArray(value) ? value : [value];
        const scrubbedItems = Array.isArray(scrubbed) ? scrubbed : [scrubbed];
        const withCapabilities = await Promise.all(
          scrubbedItems.map(async (item, index) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return item;
            }
            const instance = sourceItems[index];
            const canUpdate =
              config.permissions?.update !== false &&
              (await checkPermissions(
                "update",
                this.resourceActionPermissions(config, "update"),
                request.user as User | undefined,
                instance
              ));
            const canDelete =
              config.permissions?.delete !== false &&
              (await checkPermissions(
                "delete",
                this.resourceActionPermissions(config, "delete"),
                request.user as User | undefined,
                instance
              ));
            return {
              ...(item as Record<string, unknown>),
              _adminCapabilities: {delete: canDelete, update: canUpdate},
            };
          })
        );
        return (Array.isArray(scrubbed) ? withCapabilities : withCapabilities[0]) as JSONValue;
      };

      // noExplicitAny: matches the Model<any> from AdminModelConfig above.
      // biome-ignore lint/suspicious/noExplicitAny: matches the Model<any> from AdminModelConfig above.
      const routerOptions: ModelRouterOptions<any> = {
        ...(openApiMw ? {openApi: openApiMw} : {}),
        ...(this.options.accessControl ? {accessControl: this.options.accessControl} : {}),
        defaultLimit: config.pageSize ?? 100,
        maxLimit: 500,
        permissions: {
          create: adminPermission(config.permissions?.create, "create"),
          delete: adminPermission(config.permissions?.delete, "delete"),
          list: adminPermission(true, "list"),
          read: adminPermission(true, "read"),
          update: adminPermission(config.permissions?.update, "update"),
        },
        postCreate: async (value, request) => {
          await applyPendingUserRoles(value, request, true);
          await auditHooks.postCreate?.(value, request);
        },
        postUpdate: async (value, cleanedBody, request, prev) => {
          try {
            await applyPendingUserRoles(value, request);
          } catch (error) {
            await restoreUserFieldsAfterFailedRoleAssign(value, prev, cleanedBody);
            throw error;
          }
          await auditHooks.postUpdate?.(value, cleanedBody, request, prev);
        },
        preCreate: async (body, req) => {
          if (!body || typeof body !== "object") {
            return body;
          }
          const record = body as Record<string, unknown>;
          if (
            !(await checkPermissions(
              "create",
              this.resourceActionPermissions(config, "create"),
              req.user as User | undefined,
              record
            ))
          ) {
            throw new APIError({status: 403, title: "Admin create access denied"});
          }
          takePendingUserRoles(record, req);
          await assertCanWriteUserAdminFlag(record, req);
          markAuthorizedUserAdminWrite(record, req);
          return stripProtectedFromBody(body) as typeof body;
        },
        preUpdate: async (body, req) => {
          if (!body || typeof body !== "object") {
            return body;
          }
          const record = body as Record<string, unknown>;
          takePendingUserRoles(record, req);
          await assertCanWriteUserAdminFlag(record, req, await currentUserAdminFlag(req));
          markAuthorizedUserAdminWrite(record, req);
          return stripProtectedFromBody(body) as typeof body;
        },
        queryFields: buildAdminModelQueryFields({
          filters: config.filters,
          listDisplay: config.listDisplay,
          listFields: config.listFields,
          searchFields: modelMeta?.searchFields ?? config.searchFields,
        }),
        queryFilter: buildAdminListQueryFilter(config, modelMeta?.searchFields),
        responseHandler: async (value, _method, request): Promise<JSONValue> =>
          addRecordCapabilities(value, request),
        sort: config.defaultSort ?? "-created",
        ...(config.populatePaths ? {populatePaths: config.populatePaths} : {}),
        ...(auditHooks.postDelete ? {postDelete: auditHooks.postDelete} : {}),
      };

      const modelBase = express.Router();
      modelBase.use(validateAdminSortParam(modelMeta?.sortableFields ?? []));
      modelBase.post(
        "/bulk-patch",
        authenticateMiddleware(),
        ...asMiddlewareList(bulkPatchOpenApi),
        asyncHandler(async (req, res) => {
          if (
            !(await checkPermissions("update", updatePermissions, req.user as User | undefined))
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
          let pendingRoles: string[] | undefined;
          if (
            config.model.modelName === "User" &&
            this.options.accessControl &&
            "roles" in rawPatch
          ) {
            pendingRoles = parseRoleNames(rawPatch.roles);
          }
          if (Object.keys(patch).length === 0 && pendingRoles === undefined) {
            throw new APIError({
              status: 400,
              title: "Patch must include at least one writable field",
            });
          }
          let updated = 0;
          const failures: {id: string; title: string}[] = [];
          const actor = req.user as User | undefined;
          for (const id of ids) {
            if (!mongoose.isValidObjectId(id)) {
              failures.push({id, title: "Invalid id"});
              continue;
            }
            try {
              const doc = await config.model.findById(id);
              if (!doc) {
                failures.push({id, title: "Not found"});
                continue;
              }
              if (!(await checkPermissions("update", updatePermissions, actor, doc))) {
                failures.push({id, title: "Forbidden"});
                continue;
              }
              await assertCanWriteUserAdminFlag(
                rawPatch,
                req,
                Boolean((doc as {admin?: boolean}).admin),
                id
              );
              const previousPatch: Record<string, unknown> = {};
              for (const key of Object.keys(patch)) {
                previousPatch[key] = (doc as unknown as Record<string, unknown>)[key];
              }
              if (Object.keys(patch).length > 0) {
                await doc.updateOne({$set: patch});
              }
              try {
                if (pendingRoles) {
                  if (!actor) {
                    failures.push({id, title: "Forbidden"});
                    continue;
                  }
                  await this.options.accessControl?.roles.assign({
                    actor,
                    roleNames: pendingRoles,
                    userId: id,
                  });
                }
              } catch (roleError) {
                if (Object.keys(previousPatch).length > 0) {
                  await config.model.updateOne({_id: id}, {$set: previousPatch});
                }
                throw roleError;
              }
              updated += 1;
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

  private mountScriptRoutes(router: express.Router, scripts: AdminScriptConfig[]): void {
    const scriptsByName = new Map(scripts.map((s) => [s.name, s]));
    const scriptNames = scripts.map((s) => s.name);

    // GET /admin/scripts/runs — Paginated history of script runs (BackgroundTasks)
    router.get(
      "/runs",
      asyncHandler(async (req: express.Request, res: express.Response) => {
        const user = req.user as User | undefined;
        if (!user || !(await this.hasScriptPermission(user, "viewBackgroundTasks"))) {
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
        const user = req.user as (User & {_id: unknown; name?: string}) | undefined;
        if (!user || !(await this.hasScriptPermission(user, "runScripts"))) {
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
            createdBy: user._id as unknown as mongoose.Types.ObjectId,
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
        const user = req.user as User | undefined;
        if (!user || !(await this.hasScriptPermission(user, "viewBackgroundTasks"))) {
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
        const user = req.user as (User & {name?: string}) | undefined;
        if (!user || !(await this.hasScriptPermission(user, "runScripts"))) {
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
          {returnDocument: "after"}
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
