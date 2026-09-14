import {FileStorageService} from "@terreno/ai";
import {APIError, logger, modelRouter, Permissions, z} from "@terreno/api";
import type {Model} from "mongoose";
import {AppConfiguration} from "../models/appConfiguration";
import {getFileStorageService, setFileStorageService} from "./ai";

interface GcsConfigRequest {
  bucketName: string;
  projectId?: string;
  serviceAccountKey?: string;
}

interface GcsConfigResponse {
  bucketName: string | null;
  configured: boolean;
  hasCredentials: boolean;
  projectId: string | null;
}

const disabledCrud = {
  create: [],
  delete: [],
  list: [],
  read: [],
  update: [],
};

const configureGcsBodySchema = z
  .object({
    bucketName: z.string(),
    projectId: z.string().optional(),
    serviceAccountKey: z.string().optional(),
  })
  .strict();

const gcsStatusResponseSchema = z
  .object({
    bucketName: z.string().nullable(),
    configured: z.boolean(),
    hasCredentials: z.boolean(),
    projectId: z.string().nullable(),
  })
  .strict();

const gcsMutationResponseSchema = z
  .object({
    configured: z.boolean(),
    message: z.string(),
  })
  .strict();

const readGcsStatus = (): GcsConfigResponse => {
  const fileStorage = getFileStorageService();
  return {
    bucketName: process.env.GCS_BUCKET ?? null,
    configured: fileStorage !== undefined,
    hasCredentials: Boolean(
      process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCS_SERVICE_ACCOUNT_KEY
    ),
    projectId: process.env.GCS_PROJECT_ID ?? null,
  };
};

/**
 * GCS runtime settings as collection actions on AppConfiguration.
 * CRUD is disabled; these are named admin operations, not document CRUD.
 */
export const settingsRouter = modelRouter(
  "/settings",
  AppConfiguration as unknown as Model<unknown>,
  {
    collectionActions: {
      clearGcs: {
        handler: async () => {
          delete process.env.GCS_BUCKET;
          delete process.env.GCS_PROJECT_ID;
          delete process.env.GCS_SERVICE_ACCOUNT_KEY;
          setFileStorageService(undefined);
          logger.info("GCS configuration cleared");
          return {configured: false, message: "GCS configuration cleared"};
        },
        method: "POST",
        permissions: [Permissions.IsAdmin],
        response: gcsMutationResponseSchema,
        summary: "Clear GCS configuration",
        tag: "settings",
      },
      configureGcs: {
        body: configureGcsBodySchema,
        handler: async ({body}) => {
          const {bucketName, projectId, serviceAccountKey} = body as GcsConfigRequest;
          if (!bucketName) {
            throw new APIError({status: 400, title: "Bucket name is required"});
          }

          process.env.GCS_BUCKET = bucketName;
          if (projectId) {
            process.env.GCS_PROJECT_ID = projectId;
          }
          if (serviceAccountKey) {
            process.env.GCS_SERVICE_ACCOUNT_KEY = serviceAccountKey;
          }

          try {
            const storageOptions: {
              credentials?: Record<string, unknown>;
              projectId?: string;
            } = {};
            if (projectId) {
              storageOptions.projectId = projectId;
            }
            if (serviceAccountKey) {
              storageOptions.credentials = JSON.parse(serviceAccountKey);
            }

            const service = new FileStorageService({
              bucketName,
              storageOptions: Object.keys(storageOptions).length > 0 ? storageOptions : undefined,
            });
            setFileStorageService(service);

            logger.info(`GCS configured with bucket: ${bucketName}`);
            return {configured: true, message: "GCS configured successfully"};
          } catch (err) {
            logger.error(`Failed to configure GCS: ${err}`);
            throw new APIError({
              detail: (err as Error).message,
              status: 400,
              title: "Failed to configure GCS",
            });
          }
        },
        method: "POST",
        permissions: [Permissions.IsAdmin],
        response: gcsMutationResponseSchema,
        summary: "Configure GCS settings",
        tag: "settings",
      },
      gcs: {
        handler: async () => {
          return readGcsStatus();
        },
        method: "GET",
        permissions: [Permissions.IsAdmin],
        response: gcsStatusResponseSchema,
        summary: "Get GCS configuration status",
        tag: "settings",
      },
    },
    permissions: disabledCrud,
  }
);
