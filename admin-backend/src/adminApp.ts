import {
  getOpenApiSpecForModel,
  logger,
  type ModelRouterOptions,
  modelRouter,
  Permissions,
} from "@terreno/api";
import type express from "express";
import type {Model} from "mongoose";
import mongoose from "mongoose";
import {FeatureFlag, type FeatureFlagDocument} from "./models/featureFlag";
import {createFlagRoutes} from "./routes/flags";

export interface AdminModelConfig {
  model: Model<any>;
  routePath: string;
  displayName: string;
  listFields: string[];
  defaultSort?: string;
}

export interface FlagDefinition {
  key: string;
  flagType: "boolean" | "string";
  defaultValue: any;
  description?: string;
}

export interface AdminOptions {
  models: AdminModelConfig[];
  basePath?: string;
  flags?: FlagDefinition[];
  userModel?: Model<any>;
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
  private flagCache: Map<string, FeatureFlagDocument> = new Map();

  constructor(options: AdminOptions) {
    this.options = options;
    if (options.flags && options.flags.length > 0 && !options.userModel) {
      throw new Error("AdminApp: userModel is required when flags are configured");
    }
  }

  async register(app: express.Application): Promise<void> {
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

    // Feature flags setup
    if (this.options.flags && this.options.flags.length > 0) {
      await this.syncFlags(this.options.flags);

      // Mount flag routes
      const flagRouter = createFlagRoutes(this, this.options.userModel!);
      app.use(`${basePath}/flags`, flagRouter);
    }
  }

  private async syncFlags(flags: FlagDefinition[]): Promise<void> {
    const registeredKeys = flags.map((f) => f.key);

    const bulkOps = flags.map((flag) => ({
      updateOne: {
        filter: {key: flag.key},
        update: {
          $set: {
            defaultValue: flag.defaultValue,
            description: flag.description ?? "",
            flagType: flag.flagType as "boolean" | "string",
            status: "active" as const,
          },
          $setOnInsert: {
            enabled: false,
            key: flag.key,
          },
        },
        upsert: true,
      },
    }));

    try {
      // Try transactional sync first (requires replica set)
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await FeatureFlag.bulkWrite(bulkOps, {session});
          await FeatureFlag.updateMany(
            {key: {$nin: registeredKeys}, status: "active"},
            {$set: {status: "archived" as const}},
            {session}
          );
        });
      } finally {
        await session.endSession();
      }
    } catch (err: any) {
      // Fall back to non-transactional sync (standalone MongoDB)
      if (
        err?.message?.includes("Transaction") ||
        err?.codeName === "IllegalOperation" ||
        err?.code === 20
      ) {
        logger.debug("Transactions not available, syncing flags without transaction");
        await FeatureFlag.bulkWrite(bulkOps);
        await FeatureFlag.updateMany(
          {key: {$nin: registeredKeys}, status: "active"},
          {$set: {status: "archived" as const}}
        );
      } else {
        throw err;
      }
    }

    await this.refreshFlagCache();

    logger.info(`Feature flags synced: ${registeredKeys.length} flags registered`);
  }

  async refreshFlagCache(): Promise<void> {
    const flags = await FeatureFlag.find({});
    this.flagCache.clear();
    for (const flag of flags) {
      this.flagCache.set(flag.key, flag);
    }
  }

  async variation(key: string, user: any | null, defaultValue: any): Promise<any> {
    // Check user override first
    if (user?.featureFlags?.has?.(key)) {
      return user.featureFlags.get(key);
    }

    const flag = this.flagCache.get(key);
    if (!flag || !flag.enabled) {
      return defaultValue;
    }

    // globalValue takes priority over flag defaultValue when set
    if (flag.globalValue !== undefined && flag.globalValue !== null) {
      return flag.globalValue;
    }

    return flag.defaultValue;
  }

  async boolVariation(key: string, user: any | null, defaultValue: boolean): Promise<boolean> {
    const value = await this.variation(key, user, defaultValue);
    return Boolean(value);
  }

  async stringVariation(key: string, user: any | null, defaultValue: string): Promise<string> {
    const value = await this.variation(key, user, defaultValue);
    return String(value);
  }

  async allFlags(user: any | null): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    for (const [key, flag] of this.flagCache.entries()) {
      if (flag.status !== "active") {
        continue;
      }

      // Check user override
      if (user?.featureFlags?.has?.(key)) {
        result[key] = user.featureFlags.get(key);
        continue;
      }

      if (!flag.enabled) {
        result[key] = flag.defaultValue;
        continue;
      }

      if (flag.globalValue !== undefined && flag.globalValue !== null) {
        result[key] = flag.globalValue;
      } else {
        result[key] = flag.defaultValue;
      }
    }
    return result;
  }
}
