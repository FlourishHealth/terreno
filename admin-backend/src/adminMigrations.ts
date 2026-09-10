import {
  APIError,
  assertMigrationsAllowed,
  asyncHandler,
  authenticateMiddleware,
  BackgroundTask,
  type BackgroundTaskDocument,
  checkMigrationFiles,
  getMigrationStatus,
  logger,
  runMigrations,
  type User,
} from "@terreno/api";
import type express from "express";
import {DateTime} from "luxon";
import mongoose from "mongoose";

export const mountAdminMigrationRoutes = ({
  app,
  basePath,
  dir,
  isAdmin,
}: {
  app: express.Application;
  basePath: string;
  dir: string | undefined;
  isAdmin: (user: User | undefined) => Promise<boolean>;
}): void => {
  const requireDir = (): string => {
    if (!dir) {
      throw new APIError({status: 404, title: "Migrations are not configured"});
    }
    return dir;
  };

  app.get(
    `${basePath}/migrations`,
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      if (!(await isAdmin(req.user as User | undefined))) {
        throw new APIError({status: 403, title: "Admin access required"});
      }
      const migrationsDir = requireDir();
      const migrations = await checkMigrationFiles({dir: migrationsDir});
      const status = await getMigrationStatus({
        connection: mongoose.connection,
        migrations,
      });
      return res.json(status);
    })
  );

  app.post(
    `${basePath}/migrations/run`,
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      const actor = req.user as (User & {_id: unknown; name?: string}) | undefined;
      if (!actor || !(await isAdmin(actor))) {
        throw new APIError({status: 403, title: "Admin access required"});
      }
      const migrationsDir = requireDir();
      const isWetRun = req.query.wetRun === "true";
      assertMigrationsAllowed({
        allowEnv: process.env.ALLOW_MIGRATIONS === "true",
        dryRun: !isWetRun,
        force: true,
        isProduction: process.env.NODE_ENV === "production",
      });

      const now = DateTime.now().toJSDate();
      const task = (await BackgroundTask.create({
        createdBy: actor._id as mongoose.Types.ObjectId,
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

      return res.status(201).json({taskId: task._id.toString()});
    })
  );
};
