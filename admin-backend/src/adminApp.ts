import {
  APIError,
  asyncHandler,
  authenticateMiddleware,
  getOpenApiSpecForModel,
  type ModelRouterOptions,
  modelRouter,
  Permissions,
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
}

interface AdminFieldMeta {
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
  default?: any;
  ref?: string;
  searchable?: boolean;
}

interface AdminModelMeta {
  name: string;
  routePath: string;
  displayName: string;
  listFields: string[];
  defaultSort: string;
  fields: Record<string, AdminFieldMeta>;
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
      };
    });

    const configResponse: AdminConfigResponse = {models: configModels};

    // GET /admin/config
    app.get(`${basePath}/config`, (_req, res) => {
      return res.json(configResponse);
    });

    // Mount search endpoint for each model
    for (const config of modelConfigs) {
      const modelMeta = configModels.find((m) => m.name === config.model.modelName);
      const searchableFields = modelMeta
        ? Object.entries(modelMeta.fields)
            .filter(([, f]) => f.searchable)
            .map(([key]) => key)
        : [];

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

          if (fields.length === 0) {
            return res.json({data: []});
          }

          const orConditions = fields.map((field: string) => ({[field]: {$regex: regex}}));
          const results = await config.model.find({$or: orConditions}).limit(20).lean();
          return res.json({data: results});
        })
      );
    }

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
  }
}
