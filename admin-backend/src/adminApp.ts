import {
  APIError,
  asyncHandler,
  authenticateMiddleware,
  checkPermissions,
  getOpenApiSpecForModel,
  type ModelRouterOptions,
  modelRouter,
  Permissions,
  VersionConfig,
} from "@terreno/api";
import type express from "express";
import type {Model} from "mongoose";

export interface AdminModelConfig {
  model: Model<any>;
  routePath: string;
  displayName: string;
  listFields: string[];
  defaultSort?: string;
}

export interface AdminOptions {
  models: AdminModelConfig[];
  basePath?: string;
  /** When true, adds GET/PUT /admin/version-config routes for the singleton VersionConfig */
  versionConfig?: boolean;
}

interface AdminFieldMeta {
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
  default?: any;
  ref?: string;
}

interface AdminModelMeta {
  name: string;
  routePath: string;
  displayName: string;
  listFields: string[];
  defaultSort: string;
  fields: Record<string, AdminFieldMeta>;
  type?: "model" | "versionConfig";
}

interface AdminConfigResponse {
  models: AdminModelMeta[];
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

export class AdminApp {
  private options: AdminOptions;

  constructor(options: AdminOptions) {
    this.options = options;
  }

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

      return {
        defaultSort: config.defaultSort ?? "-created",
        displayName: config.displayName,
        fields,
        listFields: config.listFields,
        name: config.model.modelName,
        routePath: `${basePath}${config.routePath}`,
        type: "model" as const,
      };
    });

    if (this.options.versionConfig) {
      const {properties, required} = getOpenApiSpecForModel(VersionConfig);
      const versionConfigFields = extractFieldMeta(properties, required);
      configModels.push({
        defaultSort: "-created",
        displayName: "Version Config",
        fields: versionConfigFields,
        listFields: [],
        name: "VersionConfig",
        routePath: `${basePath}/version-config`,
        type: "versionConfig",
      });
    }

    const configResponse: AdminConfigResponse = {models: configModels};

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

    if (this.options.versionConfig) {
      const versionConfigPath = `${basePath}/version-config`;
      const adminOnly = [
        authenticateMiddleware(),
        asyncHandler(async (req: express.Request, _res, next: express.NextFunction) => {
          const allowed = await checkPermissions("read", [Permissions.IsAdmin], req.user as any);
          if (!allowed) {
            throw new APIError({
              status: 403,
              title: "Admin access required",
            });
          }
          next();
        }),
      ];

      app.get(
        versionConfigPath,
        ...adminOnly,
        asyncHandler(async (_req, res) => {
          const config = await VersionConfig.findOneOrNone({});
          if (!config) {
            return res.json({
              mobileRequiredVersion: 0,
              mobileWarningVersion: 0,
              requiredMessage: "This version is no longer supported. Please update to continue.",
              updateUrl: undefined,
              warningMessage: "A new version is available. Please update for the best experience.",
              webRequiredVersion: 0,
              webWarningVersion: 0,
            });
          }
          const doc = config.toObject();
          return res.json({
            mobileRequiredVersion: doc.mobileRequiredVersion ?? 0,
            mobileWarningVersion: doc.mobileWarningVersion ?? 0,
            requiredMessage:
              doc.requiredMessage ??
              "This version is no longer supported. Please update to continue.",
            updateUrl: doc.updateUrl,
            warningMessage:
              doc.warningMessage ??
              "A new version is available. Please update for the best experience.",
            webRequiredVersion: doc.webRequiredVersion ?? 0,
            webWarningVersion: doc.webWarningVersion ?? 0,
          });
        })
      );

      app.put(
        versionConfigPath,
        ...adminOnly,
        asyncHandler(async (req, res) => {
          const body = req.body as Record<string, unknown>;
          const update = {
            mobileRequiredVersion: body.mobileRequiredVersion ?? 0,
            mobileWarningVersion: body.mobileWarningVersion ?? 0,
            requiredMessage:
              (body.requiredMessage as string) ??
              "This version is no longer supported. Please update to continue.",
            updateUrl: body.updateUrl as string | undefined,
            warningMessage:
              (body.warningMessage as string) ??
              "A new version is available. Please update for the best experience.",
            webRequiredVersion: body.webRequiredVersion ?? 0,
            webWarningVersion: body.webWarningVersion ?? 0,
          };
          const config = await VersionConfig.upsert({}, update);
          const doc = config.toObject();
          return res.json({
            mobileRequiredVersion: doc.mobileRequiredVersion ?? 0,
            mobileWarningVersion: doc.mobileWarningVersion ?? 0,
            requiredMessage:
              doc.requiredMessage ??
              "This version is no longer supported. Please update to continue.",
            updateUrl: doc.updateUrl,
            warningMessage:
              doc.warningMessage ??
              "A new version is available. Please update for the best experience.",
            webRequiredVersion: doc.webRequiredVersion ?? 0,
            webWarningVersion: doc.webWarningVersion ?? 0,
          });
        })
      );
    }
  }
}
