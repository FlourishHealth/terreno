import {
  APIError,
  asyncHandler,
  authenticateMiddleware,
  BackgroundTask,
  type BackgroundTaskDocument,
  getOpenApiSpecForModel,
  logger,
  type ModelRouterOptions,
  modelRouter,
  Permissions,
  type ScriptContext,
  type ScriptResult,
  type ScriptRunner,
  TaskCancelledError,
} from "@terreno/api";
import express from "express";
import {DateTime} from "luxon";
import type {Model} from "mongoose";

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
  widget?: string;
}

interface AdminModelMeta {
  name: string;
  routePath: string;
  displayName: string;
  listFields: string[];
  defaultSort: string;
  fields: Record<string, AdminFieldMeta>;
}

interface AdminScriptMeta {
  name: string;
  description: string;
}

interface AdminConfigResponse {
  models: AdminModelMeta[];
  scripts: AdminScriptMeta[];
}

const extractFieldMeta = (
  properties: Record<string, any>,
  required: string[]
): Record<string, AdminFieldMeta> => {
  const fields: Record<string, AdminFieldMeta> = {};
  for (const [key, prop] of Object.entries(properties)) {
    fields[key] = {
      default: prop.default,
      description: prop.description,
      enum: prop.enum,
      ref: prop.$ref ? prop.$ref.replace("#/components/schemas/", "") : undefined,
      required: required.includes(key),
      type: prop.type ?? "string",
    };

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
  register(app: express.Application): void {
    const basePath = this.options.basePath ?? "/admin";
    const modelConfigs = this.options.models;

    // Build config response with field metadata from Mongoose schemas
    const configModels: AdminModelMeta[] = modelConfigs.map((config) => {
      const {properties, required} = getOpenApiSpecForModel(config.model);

      // Extract ref information directly from the Mongoose schema
      const fields = extractFieldMeta(properties, required);
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
        fields,
        listFields: config.listFields,
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

    const configResponse: AdminConfigResponse = {models: configModels, scripts: configScripts};

    // GET /admin/config
    app.get(`${basePath}/config`, (_req, res) => {
      return res.json(configResponse);
    });

    // Mount modelRouter for each model with IsAdmin permissions
    for (const config of modelConfigs) {
      const routerOptions: ModelRouterOptions<any> = {
        permissions: {
          create: [Permissions.IsAdmin],
          delete: [Permissions.IsAdmin],
          list: [Permissions.IsAdmin],
          read: [Permissions.IsAdmin],
          update: [Permissions.IsAdmin],
        },
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

        const task = (await BackgroundTask.create({
          createdBy: user._id,
          isDryRun: !isWetRun,
          logs: [
            {level: "info", message: `Script started by ${user.name ?? "admin"}`, timestamp: now},
          ],
          progress: {message: "Starting...", percentage: 0, stage: "Queued"},
          startedAt: now,
          status: "running",
          taskType: script.name,
        })) as BackgroundTaskDocument;

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

        // Run the script asynchronously
        void (async () => {
          try {
            const result: ScriptResult = await script.runner(isWetRun, ctx);

            // Check cancellation before saving result
            const current = await BackgroundTask.findById(task._id).select("status").lean();
            if (current?.status === "cancelled") {
              return;
            }

            task.status = result.success ? "completed" : "failed";
            task.result = result.results;
            task.completedAt = DateTime.now().toJSDate();
            task.progress = {message: "Done", percentage: 100, stage: "Complete"};
            await task.save();
          } catch (err: unknown) {
            if (err instanceof TaskCancelledError) {
              return;
            }
            const message = err instanceof Error ? err.message : String(err);
            logger.error(`Script ${script.name} failed: ${message}`);

            task.status = "failed";
            task.error = message;
            task.result = [message];
            task.completedAt = DateTime.now().toJSDate();
            await task.save();
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

        const task = await BackgroundTask.findById(req.params.id);
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

        const task = await BackgroundTask.findById(req.params.id);
        if (!task) {
          throw new APIError({status: 404, title: "Task not found"});
        }

        if (task.status !== "pending" && task.status !== "running") {
          throw new APIError({
            status: 400,
            title: `Cannot cancel task with status: ${task.status}`,
          });
        }

        task.status = "cancelled";
        task.completedAt = DateTime.now().toJSDate();
        task.logs.push({
          level: "info",
          message: `Task cancelled by ${user.name ?? "admin"}`,
          timestamp: DateTime.now().toJSDate(),
        });
        await task.save();

        return res.json({message: "Task cancelled", task: task.toObject()});
      })
    );
  }
}
