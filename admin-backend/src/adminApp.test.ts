import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {
  addAuthRoutes,
  apiErrorMiddleware,
  apiUnauthorizedMiddleware,
  BackgroundTask,
  type ScriptRunner,
  setupAuth,
  type UserModel as UserModelType,
} from "@terreno/api";
import {authAsUser, getBaseServer, setupDb, UserModel} from "@terreno/api/src/tests";
import type express from "express";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {AdminApp} from "./adminApp";

const createTestScript = (overrides?: {
  runner?: ScriptRunner;
  name?: string;
  description?: string;
}) => ({
  description: overrides?.description ?? "A test script",
  name: overrides?.name ?? "test-script",
  runner:
    overrides?.runner ??
    (async (wetRun: boolean) => ({
      results: [`Ran in ${wetRun ? "wet" : "dry"} mode`],
      success: true,
    })),
});

const createSlowScript = () => ({
  description: "A slow script for testing async behavior",
  name: "slow-script",
  runner: async (_wetRun: boolean) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return {results: ["Done"], success: true};
  },
});

const createFailingScript = () => ({
  description: "A script that throws",
  name: "failing-script",
  runner: async () => {
    throw new Error("Script exploded");
  },
});

const buildApp = (scripts = [createTestScript()]): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);

  const admin = new AdminApp({
    basePath: "/admin",
    models: [],
    scripts,
  });
  admin.register(app);

  // Error middleware must come after routes
  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);

  return app;
};

/** Wait long enough for async scripts to settle before cleanup. */
const waitForScripts = () => new Promise((resolve) => setTimeout(resolve, 500));

describe("AdminApp script routes", () => {
  let app: express.Application;
  let adminAgent: TestAgent;
  let notAdminAgent: TestAgent;

  afterEach(async () => {
    // Wait for any async script runners to finish before deleting tasks
    await waitForScripts();
    await BackgroundTask.deleteMany({});
  });

  describe("POST /admin/scripts/:name/run", () => {
    beforeEach(async () => {
      await setupDb();
      app = buildApp();
      adminAgent = await authAsUser(app, "admin");
      notAdminAgent = await authAsUser(app, "notAdmin");
    });

    it("starts a script and returns a taskId", async () => {
      const res = await adminAgent.post("/admin/scripts/test-script/run").expect(201);

      expect(res.body.taskId).toBeDefined();
      expect(typeof res.body.taskId).toBe("string");

      // Verify the task was created in the database
      const task = await BackgroundTask.findById(res.body.taskId);
      expect(task).not.toBeNull();
      expect(task?.taskType).toBe("test-script");
      expect(task?.isDryRun).toBe(true);
    });

    it("creates a wet run task when wetRun=true", async () => {
      const res = await adminAgent.post("/admin/scripts/test-script/run?wetRun=true").expect(201);

      const task = await BackgroundTask.findById(res.body.taskId);
      expect(task).not.toBeNull();
      expect(task?.isDryRun).toBe(false);
    });

    it("creates a dry run task by default", async () => {
      const res = await adminAgent.post("/admin/scripts/test-script/run").expect(201);

      const task = await BackgroundTask.findById(res.body.taskId);
      expect(task).not.toBeNull();
      expect(task?.isDryRun).toBe(true);
    });

    it("returns 404 for unknown script", async () => {
      const res = await adminAgent.post("/admin/scripts/nonexistent/run").expect(404);

      expect(res.body.title).toInclude("Script not found");
    });

    it("returns 403 for non-admin user", async () => {
      const res = await notAdminAgent.post("/admin/scripts/test-script/run").expect(403);

      expect(res.body.title).toInclude("Only admins can run scripts");
    });

    it("returns 401 for unauthenticated user", async () => {
      const unauthAgent = supertest(app);
      await unauthAgent.post("/admin/scripts/test-script/run").expect(401);
    });

    it("records initial log with admin name", async () => {
      const res = await adminAgent.post("/admin/scripts/test-script/run").expect(201);

      const task = await BackgroundTask.findById(res.body.taskId);
      expect(task?.logs).toHaveLength(1);
      expect(task?.logs[0].level).toBe("info");
      expect(task?.logs[0].message).toInclude("Script started by");
    });

    it("completes the task asynchronously with results", async () => {
      const res = await adminAgent.post("/admin/scripts/test-script/run").expect(201);

      // Wait for async script execution
      await new Promise((resolve) => setTimeout(resolve, 100));

      const task = await BackgroundTask.findById(res.body.taskId);
      expect(task?.status).toBe("completed");
      expect(task?.result).toContain("Ran in dry mode");
      expect(task?.completedAt).toBeDefined();
      expect(task?.progress?.percentage).toBe(100);
    });

    it("marks task as failed when script throws", async () => {
      app = buildApp([createFailingScript()]);
      adminAgent = await authAsUser(app, "admin");

      const res = await adminAgent.post("/admin/scripts/failing-script/run").expect(201);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const task = await BackgroundTask.findById(res.body.taskId);
      expect(task?.status).toBe("failed");
      expect(task?.error).toBe("Script exploded");
      expect(task?.result).toContain("Script exploded");
    });
  });

  describe("GET /admin/scripts/tasks/:id", () => {
    let taskId: string;

    beforeEach(async () => {
      await setupDb();
      app = buildApp([createSlowScript()]);
      adminAgent = await authAsUser(app, "admin");
      notAdminAgent = await authAsUser(app, "notAdmin");

      const res = await adminAgent.post("/admin/scripts/slow-script/run").expect(201);
      taskId = res.body.taskId;
    });

    it("returns task status for admin", async () => {
      const res = await adminAgent.get(`/admin/scripts/tasks/${taskId}`).expect(200);

      expect(res.body.task).toBeDefined();
      expect(res.body.task._id).toBe(taskId);
      expect(res.body.task.taskType).toBe("slow-script");
      expect(res.body.task.status).toBeDefined();
    });

    it("returns 403 for non-admin user", async () => {
      const res = await notAdminAgent.get(`/admin/scripts/tasks/${taskId}`).expect(403);

      expect(res.body.title).toInclude("Only admins can view tasks");
    });

    it("returns 404 for nonexistent task", async () => {
      const fakeId = "000000000000000000000000";
      const res = await adminAgent.get(`/admin/scripts/tasks/${fakeId}`).expect(404);

      expect(res.body.title).toInclude("Task not found");
    });

    it("returns 400 for invalid task ID", async () => {
      const res = await adminAgent.get("/admin/scripts/tasks/not-a-valid-id").expect(400);

      expect(res.body.title).toInclude("Invalid task ID");
    });

    it("shows completed task with results after script finishes", async () => {
      // Wait for the slow script to finish
      await new Promise((resolve) => setTimeout(resolve, 400));

      const res = await adminAgent.get(`/admin/scripts/tasks/${taskId}`).expect(200);

      expect(res.body.task.status).toBe("completed");
      expect(res.body.task.result).toContain("Done");
    });
  });

  describe("DELETE /admin/scripts/tasks/:id", () => {
    beforeEach(async () => {
      await setupDb();
      app = buildApp([createSlowScript()]);
      adminAgent = await authAsUser(app, "admin");
      notAdminAgent = await authAsUser(app, "notAdmin");
    });

    it("cancels a running task", async () => {
      const res1 = await adminAgent.post("/admin/scripts/slow-script/run").expect(201);

      const res = await adminAgent.delete(`/admin/scripts/tasks/${res1.body.taskId}`).expect(200);

      expect(res.body.message).toBe("Task cancelled");
      expect(res.body.task.status).toBe("cancelled");
      expect(res.body.task.completedAt).toBeDefined();
    });

    it("adds cancellation log entry", async () => {
      const res1 = await adminAgent.post("/admin/scripts/slow-script/run").expect(201);

      const res = await adminAgent.delete(`/admin/scripts/tasks/${res1.body.taskId}`).expect(200);

      const logs = res.body.task.logs;
      const cancelLog = logs.find((l: {message: string; level: string}) =>
        l.message.includes("cancelled")
      );
      expect(cancelLog).toBeDefined();
      expect(cancelLog.level).toBe("info");
    });

    it("returns 403 for non-admin user", async () => {
      const res1 = await adminAgent.post("/admin/scripts/slow-script/run").expect(201);

      const res = await notAdminAgent
        .delete(`/admin/scripts/tasks/${res1.body.taskId}`)
        .expect(403);

      expect(res.body.title).toInclude("Only admins can cancel tasks");
    });

    it("returns 400 when cancelling a completed task", async () => {
      const res1 = await adminAgent.post("/admin/scripts/slow-script/run").expect(201);

      // Wait for task to complete
      await new Promise((resolve) => setTimeout(resolve, 400));

      const res = await adminAgent.delete(`/admin/scripts/tasks/${res1.body.taskId}`).expect(400);

      expect(res.body.title).toInclude("Cannot cancel task with status");
    });

    it("returns 404 for nonexistent task", async () => {
      const fakeId = "000000000000000000000000";
      const res = await adminAgent.delete(`/admin/scripts/tasks/${fakeId}`).expect(404);

      expect(res.body.title).toInclude("Task not found");
    });

    it("returns 400 for invalid task ID", async () => {
      const res = await adminAgent.delete("/admin/scripts/tasks/not-a-valid-id").expect(400);

      expect(res.body.title).toInclude("Invalid task ID");
    });
  });

  describe("GET /admin/config with scripts", () => {
    beforeEach(async () => {
      await setupDb();
      app = buildApp([
        createTestScript({description: "Migrate old data", name: "migrate-data"}),
        createTestScript({description: "Clean up orphans", name: "cleanup"}),
      ]);
      adminAgent = await authAsUser(app, "admin");
    });

    it("includes scripts in config response", async () => {
      const res = await adminAgent.get("/admin/config").expect(200);

      expect(res.body.scripts).toHaveLength(2);
      expect(res.body.scripts[0].name).toBe("migrate-data");
      expect(res.body.scripts[0].description).toBe("Migrate old data");
      expect(res.body.scripts[1].name).toBe("cleanup");
      expect(res.body.scripts[1].description).toBe("Clean up orphans");
    });

    it("returns empty scripts array when no scripts configured", async () => {
      app = buildApp([]);
      const freshAdmin = await authAsUser(app, "admin");
      const res = await freshAdmin.get("/admin/config").expect(200);

      expect(res.body.scripts).toHaveLength(0);
    });
  });
});
