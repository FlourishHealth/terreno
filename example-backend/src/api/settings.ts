import {FileStorageService} from "@terreno/ai";
import {APIError, asyncHandler, authenticateMiddleware, createOpenApiBuilder, logger} from "@terreno/api";
import type {ModelRouterOptions} from "@terreno/api";
import type express from "express";

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

// biome-ignore lint/suspicious/noExplicitAny: Router type flexibility
export const addSettingsRoutes = (router: any, options?: Partial<ModelRouterOptions<any>>): void => {
  router.get(
    "/settings/gcs",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(options ?? {})
        .withTags(["settings"])
        .withSummary("Get GCS configuration status")
        .withResponse(200, {
          bucketName: {type: "string"},
          configured: {type: "boolean"},
          hasCredentials: {type: "boolean"},
          projectId: {type: "string"},
        })
        .build(),
    ],
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      const fileStorage = getFileStorageService();
      const bucketName = process.env.GCS_BUCKET ?? null;
      const projectId = process.env.GCS_PROJECT_ID ?? null;
      const hasCredentials = Boolean(
        process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCS_SERVICE_ACCOUNT_KEY
      );

      const response: GcsConfigResponse = {
        bucketName,
        configured: fileStorage !== undefined,
        hasCredentials,
        projectId,
      };

      return res.json({data: response});
    })
  );

  router.post(
    "/settings/gcs",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(options ?? {})
        .withTags(["settings"])
        .withSummary("Configure GCS settings")
        .withRequestBody({
          bucketName: {type: "string"},
          projectId: {type: "string"},
          serviceAccountKey: {type: "string"},
        })
        .withResponse(200, {
          configured: {type: "boolean"},
          message: {type: "string"},
        })
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const {bucketName, projectId, serviceAccountKey} = req.body as GcsConfigRequest;

      if (!bucketName) {
        throw new APIError({status: 400, title: "Bucket name is required"});
      }

      // Store in process.env for the running session
      process.env.GCS_BUCKET = bucketName;
      if (projectId) {
        process.env.GCS_PROJECT_ID = projectId;
      }
      if (serviceAccountKey) {
        process.env.GCS_SERVICE_ACCOUNT_KEY = serviceAccountKey;
      }

      try {
        // Build Storage options
        // biome-ignore lint/suspicious/noExplicitAny: Dynamic GCS credentials
        const storageOptions: any = {};
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
        return res.json({data: {configured: true, message: "GCS configured successfully"}});
      } catch (err) {
        logger.error(`Failed to configure GCS: ${err}`);
        throw new APIError({
          detail: (err as Error).message,
          status: 400,
          title: "Failed to configure GCS",
        });
      }
    })
  );

  router.delete(
    "/settings/gcs",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(options ?? {})
        .withTags(["settings"])
        .withSummary("Clear GCS configuration")
        .withResponse(200, {
          configured: {type: "boolean"},
          message: {type: "string"},
        })
        .build(),
    ],
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      delete process.env.GCS_BUCKET;
      delete process.env.GCS_PROJECT_ID;
      delete process.env.GCS_SERVICE_ACCOUNT_KEY;
      setFileStorageService(undefined);

      logger.info("GCS configuration cleared");
      return res.json({data: {configured: false, message: "GCS configuration cleared"}});
    })
  );
};
