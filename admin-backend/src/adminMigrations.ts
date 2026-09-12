import {
  APIError,
  assertMigrationsAllowed,
  BackgroundTask,
  type BackgroundTaskDocument,
  checkMigrationFiles,
  getMigrationStatus,
  logger,
  modelRouter,
  type OpenApiMiddleware,
  type PermissionMethod,
  runMigrations,
  type User,
  z,
} from "@terreno/api";
import type express from "express";
import {DateTime} from "luxon";
import mongoose from "mongoose";

const DISABLED_CRUD = {
  create: [] as PermissionMethod<unknown>[],
  delete: [] as PermissionMethod<unknown>[],
  list: [] as PermissionMethod<unknown>[],
  read: [] as PermissionMethod<unknown>[],
  update: [] as PermissionMethod<unknown>[],
};

const runQuerySchema = z.object({
  wetRun: z.enum(["true", "false"]).optional(),
});

export const mountAdminMigrationRoutes = ({
  app,
  basePath,
  dir,
  openApi,
  runPermissions,
  statusPermissions,
}: {
  app: express.Application;
  basePath: string;
  dir: string | undefined;
  openApi?: OpenApiMiddleware;
  runPermissions: PermissionMethod<unknown>[];
  statusPermissions: PermissionMethod<unknown>[];
}): void => {
  const requireDir = (): string => {
    if (!dir) {
      throw new APIError({status: 404, title: "Migrations are not configured"});
    }
    return dir;
  };

  app.use(
    `${basePath}/migrations`,
    modelRouter(BackgroundTask, {
      ...(openApi ? {openApi} : {}),
      collectionActions: {
        run: {
          handler: async ({query, user}) => {
            const actor = user as (User & {_id: unknown; name?: string}) | undefined;
            if (!actor) {
              throw new APIError({status: 403, title: "Admin access required"});
            }
            const migrationsDir = requireDir();
            const isWetRun = (query as {wetRun?: string}).wetRun === "true";
            assertMigrationsAllowed({
              allowEnv: process.env.ALLOW_MIGRATIONS === "true",
              dryRun: !isWetRun,
              force: true,
              isProduction: process.env.NODE_ENV === "production",
            });

            const now = DateTime.now().toJSDate();
            const task = (await BackgroundTask.create({
              createdBy: actor._id as unknown as mongoose.Types.ObjectId,
              isDryRun: !isWetRun,
              logs: [
                {
                  level: "info",
                  message: `Migrations ${isWetRun ? "apply" : "dry-run"} started by ${actor.name ?? "admin"}`,
                  timestamp: now,
                },
              ],
              progress: {message: "Starting...", percentage: 0, stage: "Queued"},
              startedAt: now,
              status: "running",
              taskType: "migrations:up",
            })) as BackgroundTaskDocument;

            void (async () => {
              try {
                const migrations = await checkMigrationFiles({dir: migrationsDir});
                const result = await runMigrations({
                  checkCancellation: async () => {
                    await BackgroundTask.checkCancellation(task._id.toString());
                  },
                  connection: mongoose.connection,
                  dryRun: !isWetRun,
                  migrations,
                  mongoose,
                });
                await BackgroundTask.findOneAndUpdate(
                  {_id: task._id, status: "running"},
                  {
                    $set: {
                      completedAt: DateTime.now().toJSDate(),
                      progress: {message: "Done", percentage: 100, stage: "Complete"},
                      result: result.applied,
                      status: "completed",
                    },
                  }
                );
              } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                logger.error(`Admin migrations run failed: ${detail}`);
                await BackgroundTask.findOneAndUpdate(
                  {_id: task._id, status: "running"},
                  {
                    $set: {
                      completedAt: DateTime.now().toJSDate(),
                      error: detail,
                      status: "failed",
                    },
                  }
                );
              }
            })();

            return {taskId: task._id.toString()};
          },
          method: "POST",
          permissions: runPermissions,
          query: runQuerySchema,
          status: 201,
          summary: "Dry-run or apply pending MongoDB migrations",
          tag: "adminMigrations",
        },
        status: {
          handler: async () => {
            const migrationsDir = requireDir();
            const migrations = await checkMigrationFiles({dir: migrationsDir});
            return getMigrationStatus({
              connection: mongoose.connection,
              migrations,
            });
          },
          method: "GET",
          permissions: statusPermissions,
          summary: "List applied and pending MongoDB migrations",
          tag: "adminMigrations",
        },
      },
      permissions: DISABLED_CRUD,
    })
  );
};
