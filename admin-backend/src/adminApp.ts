import {
  APIError,
  asyncHandler,
  authenticateMiddleware,
  BackgroundTask,
  type BackgroundTaskDocument,
  checkPermissions,
  getOpenApiSpecForModel,
  logger,
  type ModelRouterOptions,
  modelRouter,
  Permissions,
  type ScriptContext,
  type ScriptResult,
  type ScriptRunner,
  TaskCancelledError,
  VersionConfig,
} from "@terreno/api";
import express from "express";
import {DateTime} from "luxon";
import type {Model} from "mongoose";
import mongoose from "mongoose";

/**
 * Configuration for a single model in the admin panel.
 */
export interface AdminFieldOverride {
  /** Widget to use for this field in the admin form (e.g., "markdown") */
  widget?: string;
}

export interface AdminModelConfig {
  /** The Mongoose model to expose in the admin panel */
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
}

/**
 * Configuration for a script that can be run from the admin panel.
 */
export interface AdminScriptConfig {
  /** Unique name for this script (used as route key) */
  name: string;
  /** Human-readable description shown in the admin UI */
  description: string;
  /** The function that executes the script. Must return string[] results. */
  runner: ScriptRunner;
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
}

interface AdminFieldMeta {
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
  default?: any;
  ref?: string;
  searchable?: boolean;
  widget?: string;
  /** For array fields: metadata about each item's sub-fields */
  items?: Record<string, AdminFieldMeta>;
}

interface AdminModelMeta {
  name: string;
  routePath: string;
  displayName: string;
  listFields: string[];
  defaultSort: string;
  fields: Record<string, AdminFieldMeta>;
  fieldOrder?: string[];
}

interface AdminScriptMeta {
  name: string;
  description: string;
}

interface AdminConfigResponse {
  customScreens?: {displayName: string; name: string}[];
  models: AdminModelMeta[];
  scripts: AdminScriptMeta[];
}

const toPlainObject = (value: any): any => {
  if (value && typeof value === "object" && typeof value.toObject === "function") {
    return value.toObject();
  }
  return value;
};

const removeHiddenFields = (value: unknown, hiddenFieldSet: Set<string>): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => removeHiddenFields(item, hiddenFieldSet));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const plainValue = toPlainObject(value as any);
  const nextValue: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(plainValue)) {
    if (!hiddenFieldSet.has(key)) {
      nextValue[key] = fieldValue;
    }
  }
  return nextValue;
};

const extractFieldMeta = (
  properties: Record<string, any>,
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
      fields[key].items = extractFieldMeta(prop.items.properties, itemRequired);
    }

    // Check for ObjectId references in the raw property
    if (!fields[key].ref && prop.type === "string" && prop.format === "objectid") {
      // mongoose-to-swagger may not preserve ref directly; we'll handle this in register()
    }
  }
  return fields;
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
    const modelConfigs = this.options.models;

    // Build config response with field metadata from Mongoose schemas
    const configModels: AdminModelMeta[] = modelConfigs.map((config) => {
      const {properties, required} = getOpenApiSpecForModel(config.model);
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
          // Handle array of refs
          if (Array.isArray(pathOptions?.type) && pathOptions.type[0]?.ref) {
            field.ref = pathOptions.type[0].ref;
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

      return {
        defaultSort: config.defaultSort ?? "-created",
        displayName: config.displayName,
        fieldOrder: config.fieldOrder,
        fields,
        listFields: config.listFields.filter((field) => !hiddenFieldSet.has(field)),
        name: config.model.modelName,
        routePath: `${basePath}${config.routePath}`,
      };
    });

    // Build script metadata for config response
    const scriptConfigs = this.options.scripts ?? [];
    const configScripts: AdminScriptMeta[] = scriptConfigs.map((script) => ({
      description: script.description,
      name: script.name,
    }));

    const configResponse: AdminConfigResponse = {
      customScreens: [
        {
          displayName: "Version Config",
          name: "version-config",
        },
      ],
      models: configModels,
      scripts: configScripts,
    };

    // GET /admin/config
    app.get(
      `${basePath}/config`,
      authenticateMiddleware(),
      asyncHandler(async (req, res) => {
        if (!(await checkPermissions("read", [Permissions.IsAdmin], req.user as any))) {
          throw new APIError({status: 403, title: "Admin access required"});
        }
        return res.json(configResponse);
      })
    );

    // Version config singleton routes (GET/PUT /admin/version-config)
    const versionConfigPath = `${basePath}/version-config`;
    app.get(
      versionConfigPath,
      authenticateMiddleware(),
      asyncHandler(async (req, res) => {
        if (!(await checkPermissions("read", [Permissions.IsAdmin], req.user as any))) {
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
        if (!(await checkPermissions("update", [Permissions.IsAdmin], req.user as any))) {
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
      logger.info(`Admin search fields for ${config.model.modelName}`, {
        objectIdFields,
        searchableFields,
      });

      app.get(
        `${basePath}${config.routePath}/search`,
        authenticateMiddleware(),
        asyncHandler(async (req, res) => {
          if (!(req as any).user?.admin) {
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
      const routerOptions: ModelRouterOptions<any> = {
        ...(openApi
          ? {openApi: openApi as NonNullable<ModelRouterOptions<any>["openApi"]>}
          : {}),
        permissions: {
          create: [Permissions.IsAdmin],
          delete: [Permissions.IsAdmin],
          list: [Permissions.IsAdmin],
          read: [Permissions.IsAdmin],
          update: [Permissions.IsAdmin],
        },
        responseHandler:
          hiddenFieldSet.size > 0
            ? async (value, _method, _request, _options): Promise<any> =>
                removeHiddenFields(value, hiddenFieldSet) as any
            : undefined,
        sort: config.defaultSort ?? "-created",
      };

      app.use(`${basePath}${config.routePath}`, modelRouter(config.model, routerOptions));
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

        // Build context for cancellation and progress reporting
        const ctx: ScriptContext = {
          addLog: async (level, message) => {
            const current = await BackgroundTask.findById(task._id);
            if (current) {
              await current.addLog(level, message);
            }
          },
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

        let task;
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

        let task;
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
