// biome-ignore-all lint/suspicious/noExplicitAny: test server/model bridging mirrors projects.test.ts and server.ts
import {beforeEach, describe, expect, it} from "bun:test";
import {
  generateTokens,
  type ModelRouterOptions,
  type ModelRouterRegistration,
  TerrenoApp,
} from "@terreno/api";
import express from "express";
import supertest from "supertest";
import {Todo} from "../models";
import {User as UserModel} from "../models/user";
import {addLoadTestRoutes} from "./loadtest";

/**
 * Route tests for the SyncDB "load lab" admin routes (generate/churn/clear). Mirrors the
 * server-bootstrapping pattern established in `src/api/projects.test.ts`: a standalone
 * `TerrenoApp` built directly around the route under test (not the full `server.ts`
 * wiring), real Mongo via the package's bun preload (`src/tests/setup.ts`), real
 * passport-local-mongoose users, and supertest over HTTP.
 *
 * `addLoadTestRoutes` takes a raw `(router, options)` function rather than a
 * `ModelRouterRegistration`, so it needs the same `createOpenApiAwareRouteRegistration`
 * adapter `server.ts` uses to mount it on a `TerrenoApp`.
 */
type RegisterRoutesWithOptions = (
  router: express.Router,
  options?: Partial<ModelRouterOptions<unknown>>
) => void;

const createOpenApiAwareRouteRegistration = (
  registerRoutes: RegisterRoutesWithOptions
): ModelRouterRegistration => {
  const buildRouter = (openApi?: unknown): express.Router => {
    const router = express.Router();
    const routeOptions = openApi ? ({openApi} as Partial<ModelRouterOptions<unknown>>) : undefined;
    registerRoutes(router, routeOptions);
    return router;
  };

  const registration: ModelRouterRegistration = {
    __type: "modelRouter",
    _buildWithOpenApi: buildRouter,
    path: "/",
    router: express.Router(),
  };
  return registration;
};

describe("loadtest routes", () => {
  const buildApp = () => {
    process.env.TOKEN_SECRET = process.env.TOKEN_SECRET || "test-secret";
    process.env.TOKEN_ISSUER = process.env.TOKEN_ISSUER || "example-backend-test";
    return new TerrenoApp({
      authOptions: {
        generateJWTPayload: (user: unknown) => ({
          admin: (user as {admin?: boolean}).admin === true,
        }),
      },
      skipListen: true,
      userModel: UserModel as any,
    })
      .register(createOpenApiAwareRouteRegistration(addLoadTestRoutes))
      .build();
  };

  const createUser = async (email: string, admin: boolean) => {
    return UserModel.register(
      {admin, email, name: email} as any,
      "password12345"
    ) as unknown as Promise<{_id: unknown; admin: boolean}>;
  };

  const tokenFor = async (user: {_id: unknown; admin: boolean}): Promise<string> => {
    const {token} = await generateTokens(user);
    if (!token) {
      throw new Error("Failed to generate a token for test user");
    }
    return token;
  };

  /** Raw collection count, bypassing isDeletedPlugin's default `deleted: {$ne: true}` filter. */
  const rawTodoCount = async (query: Record<string, unknown>): Promise<number> => {
    return Todo.collection.countDocuments(query);
  };

  beforeEach(async () => {
    // Todo is sync-enabled (syncPlugin forbids multi-document writes, including through
    // Model.deleteMany) — clear via the raw collection instead, matching the convention
    // in api/src/sync/integration.test.ts and example-backend/src/api/projects.test.ts.
    await Todo.collection.deleteMany({});
    await UserModel.deleteMany({});
  });

  describe("admin guard", () => {
    it("rejects an unauthenticated request with 401", async () => {
      const app = buildApp();
      const res = await supertest(app).post("/loadtest/todos/generate").send({count: 1});
      expect(res.status).toBe(401);
    });

    it("rejects a non-admin authenticated user with 403 on generate", async () => {
      const app = buildApp();
      const user = await createUser("nonadmin-generate@example.com", false);
      const token = await tokenFor(user);

      const res = await supertest(app)
        .post("/loadtest/todos/generate")
        .set("Authorization", `Bearer ${token}`)
        .send({count: 1});

      expect(res.status).toBe(403);
      expect(await rawTodoCount({})).toBe(0);
    });

    it("rejects a non-admin authenticated user with 403 on churn", async () => {
      const app = buildApp();
      const user = await createUser("nonadmin-churn@example.com", false);
      const token = await tokenFor(user);

      const res = await supertest(app)
        .post("/loadtest/todos/churn")
        .set("Authorization", `Bearer ${token}`)
        .send({creates: 1});

      expect(res.status).toBe(403);
    });

    it("rejects a non-admin authenticated user with 403 on clear", async () => {
      const app = buildApp();
      const user = await createUser("nonadmin-clear@example.com", false);
      const token = await tokenFor(user);

      const res = await supertest(app)
        .post("/loadtest/todos/clear")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("allows an admin user through the guard", async () => {
      const app = buildApp();
      const admin = await createUser("admin-guard@example.com", true);
      const token = await tokenFor(admin);

      const res = await supertest(app)
        .post("/loadtest/todos/generate")
        .set("Authorization", `Bearer ${token}`)
        .send({count: 3});

      expect(res.status).toBe(200);
      expect(res.body.data.created).toBe(3);
    });
  });

  describe("count clamps", () => {
    it("clamps generate's count to MAX_GENERATE (5000) when the request exceeds it", async () => {
      const app = buildApp();
      const admin = await createUser("admin-clamp-generate@example.com", true);
      const token = await tokenFor(admin);

      const res = await supertest(app)
        .post("/loadtest/todos/generate")
        .set("Authorization", `Bearer ${token}`)
        .send({count: 5_001});

      expect(res.status).toBe(200);
      expect(res.body.data.created).toBe(5_000);
      expect(await rawTodoCount({ownerId: admin._id})).toBe(5_000);
    }, 30_000);

    it("defaults generate's count to 1000 when count is omitted", async () => {
      const app = buildApp();
      const admin = await createUser("admin-default-generate@example.com", true);
      const token = await tokenFor(admin);

      const res = await supertest(app)
        .post("/loadtest/todos/generate")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.created).toBe(1_000);
    }, 15_000);

    it("clamps churn's creates/updates/deletes each to MAX_CHURN_OPS (500) independently", async () => {
      const app = buildApp();
      const admin = await createUser("admin-clamp-churn@example.com", true);
      const token = await tokenFor(admin);

      // Seed enough existing todos that update/delete sampling isn't starved.
      await Todo.insertMany(
        Array.from({length: 1_000}, (_v, i) => ({
          completed: false,
          ownerId: admin._id,
          title: `seed-${i}`,
        }))
      );

      const res = await supertest(app)
        .post("/loadtest/todos/churn")
        .set("Authorization", `Bearer ${token}`)
        .send({creates: 501, deletes: 501, updates: 501});

      expect(res.status).toBe(200);
      expect(res.body.data.created).toBe(500);
      expect(res.body.data.updated).toBe(500);
      expect(res.body.data.deleted).toBe(500);
    }, 30_000);

    it("clampCount behavior via HTTP: zero/negative/non-numeric counts yield zero created", async () => {
      const app = buildApp();
      const admin = await createUser("admin-clamp-invalid@example.com", true);
      const token = await tokenFor(admin);

      for (const invalidCount of [0, -5, "not-a-number"]) {
        const res = await supertest(app)
          .post("/loadtest/todos/generate")
          .set("Authorization", `Bearer ${token}`)
          .send({count: invalidCount});

        expect(res.status).toBe(200);
        expect(res.body.data.created).toBe(0);
      }
      expect(await rawTodoCount({ownerId: admin._id})).toBe(0);
    });
  });

  describe("soft-delete-only invariant", () => {
    it("clear soft-deletes every todo for the user (raw count unchanged, live query count drops to 0)", async () => {
      const app = buildApp();
      const admin = await createUser("admin-clear@example.com", true);
      const token = await tokenFor(admin);

      await Todo.insertMany(
        Array.from({length: 10}, (_v, i) => ({
          completed: false,
          ownerId: admin._id,
          title: `clear-me-${i}`,
        }))
      );

      const res = await supertest(app)
        .post("/loadtest/todos/clear")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(10);

      // Raw collection count is unchanged — nothing was hard-deleted.
      expect(await rawTodoCount({ownerId: admin._id})).toBe(10);
      // Every raw doc is now a soft-delete tombstone.
      expect(await rawTodoCount({deleted: true, ownerId: admin._id})).toBe(10);
      // The normal Mongoose query (isDeletedPlugin's default `deleted: {$ne: true}` filter,
      // applied via `pre("find")`) now returns none. `countDocuments` bypasses that hook
      // (isDeletedPlugin only wires `find`/`findOne`), so `find()` is the correct check.
      expect(await Todo.find({ownerId: admin._id})).toHaveLength(0);
    });

    it("churn's delete path is soft-delete-only", async () => {
      const app = buildApp();
      const admin = await createUser("admin-churn-delete@example.com", true);
      const token = await tokenFor(admin);

      await Todo.insertMany(
        Array.from({length: 5}, (_v, i) => ({
          completed: false,
          ownerId: admin._id,
          title: `churn-delete-${i}`,
        }))
      );

      const res = await supertest(app)
        .post("/loadtest/todos/churn")
        .set("Authorization", `Bearer ${token}`)
        .send({deletes: 5});

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(5);

      // Raw collection count is unchanged — nothing was hard-deleted.
      expect(await rawTodoCount({ownerId: admin._id})).toBe(5);
      expect(await rawTodoCount({deleted: true, ownerId: admin._id})).toBe(5);
      expect(await Todo.find({ownerId: admin._id})).toHaveLength(0);
    });
  });

  describe("happy path and ownerId scoping", () => {
    it("generate creates todos scoped to the caller's own ownerId", async () => {
      const app = buildApp();
      const admin = await createUser("admin-happy-generate@example.com", true);
      const token = await tokenFor(admin);

      const res = await supertest(app)
        .post("/loadtest/todos/generate")
        .set("Authorization", `Bearer ${token}`)
        .send({count: 5});

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({created: 5});

      const created = await Todo.find({ownerId: admin._id});
      expect(created).toHaveLength(5);
      for (const todo of created) {
        expect(String(todo.ownerId)).toBe(String(admin._id));
        expect(typeof todo.title).toBe("string");
        expect(typeof todo.completed).toBe("boolean");
      }
    });

    it("churn applies a mixed create/update/delete batch and returns the response shape", async () => {
      const app = buildApp();
      const admin = await createUser("admin-happy-churn@example.com", true);
      const token = await tokenFor(admin);

      await Todo.insertMany(
        Array.from({length: 6}, (_v, i) => ({
          completed: false,
          ownerId: admin._id,
          title: `churn-seed-${i}`,
        }))
      );

      const res = await supertest(app)
        .post("/loadtest/todos/churn")
        .set("Authorization", `Bearer ${token}`)
        .send({creates: 2, deletes: 2, updates: 2});

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({created: 2, deleted: 2, updated: 2});
    });

    it("never affects another user's todos via generate/churn/clear (ownerId scoping)", async () => {
      const app = buildApp();
      const adminA = await createUser("admin-scope-a@example.com", true);
      const adminB = await createUser("admin-scope-b@example.com", true);
      const tokenA = await tokenFor(adminA);

      // B seeds some todos of its own.
      await Todo.insertMany(
        Array.from({length: 4}, (_v, i) => ({
          completed: false,
          ownerId: adminB._id,
          title: `b-seed-${i}`,
        }))
      );

      // A generates, churns, and clears — none of it should touch B's todos.
      await supertest(app)
        .post("/loadtest/todos/generate")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({count: 3});
      await supertest(app)
        .post("/loadtest/todos/churn")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({creates: 1});
      await supertest(app).post("/loadtest/todos/clear").set("Authorization", `Bearer ${tokenA}`);

      // B's todos are untouched and still live (not soft-deleted).
      expect(await Todo.find({ownerId: adminB._id})).toHaveLength(4);
      expect(await rawTodoCount({deleted: true, ownerId: adminB._id})).toBe(0);

      // A's own todos were all soft-deleted by clear.
      expect(await Todo.find({ownerId: adminA._id})).toHaveLength(0);
    });
  });
});
