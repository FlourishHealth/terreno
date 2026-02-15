import {beforeEach, describe, expect, it} from "bun:test";
import supertest from "supertest";
import {TerrenoApp} from "./terrenoApp";
import type {TerrenoAppOptions} from "./terrenoAppOptions";
import {setupDb, UserModel} from "./tests";

const createTestOptions = (overrides?: Partial<TerrenoAppOptions>): TerrenoAppOptions => ({
  auth: {
    refreshToken: {
      secret: "test-refresh-secret",
    },
    session: {
      secret: "test-session-secret",
    },
    token: {
      expiresIn: "1h",
      issuer: "terreno-test",
      secret: "test-secret",
    },
    userModel: UserModel as any,
  },
  logging: {
    disableFileLogging: true,
    logRequests: false,
  },
  server: {
    skipListen: true,
  },
  ...overrides,
});

describe("TerrenoApp Health Endpoint", () => {
  beforeEach(async () => {
    await setupDb();
  });

  describe("default behavior", () => {
    it("returns healthy:true at /health by default", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const app = terrenoApp.build();

      const res = await supertest(app).get("/health").expect(200);
      expect(res.body.healthy).toBe(true);
    });

    it("returns JSON content type", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const app = terrenoApp.build();

      const res = await supertest(app).get("/health").expect(200);
      expect(res.headers["content-type"]).toContain("application/json");
    });

    it("does not require authentication", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const app = terrenoApp.build();

      // No auth header set
      await supertest(app).get("/health").expect(200);
    });
  });

  describe("disabled", () => {
    it("returns 404 when health is disabled", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          health: {enabled: false},
        })
      );
      terrenoApp.addRoute("/fallback", (router) => {
        router.get("/", (_req, res) => res.json({ok: true}));
      });
      const app = terrenoApp.build();

      await supertest(app).get("/health").expect(404);
    });
  });

  describe("custom path", () => {
    it("serves health at custom path", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          health: {path: "/healthz"},
        })
      );
      const app = terrenoApp.build();

      await supertest(app).get("/health").expect(404);
      const res = await supertest(app).get("/healthz").expect(200);
      expect(res.body.healthy).toBe(true);
    });

    it("supports nested path", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          health: {path: "/api/health"},
        })
      );
      const app = terrenoApp.build();

      const res = await supertest(app).get("/api/health").expect(200);
      expect(res.body.healthy).toBe(true);
    });
  });

  describe("custom check function", () => {
    it("returns healthy result from custom check", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          health: {
            check: () => ({
              details: {
                database: "connected",
                uptime: 123,
              },
              healthy: true,
            }),
          },
        })
      );
      const app = terrenoApp.build();

      const res = await supertest(app).get("/health").expect(200);
      expect(res.body.healthy).toBe(true);
      expect(res.body.details.database).toBe("connected");
      expect(res.body.details.uptime).toBe(123);
    });

    it("returns 503 when custom check reports unhealthy", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          health: {
            check: () => ({
              details: {
                database: "disconnected",
                redis: "timeout",
              },
              healthy: false,
            }),
          },
        })
      );
      const app = terrenoApp.build();

      const res = await supertest(app).get("/health").expect(503);
      expect(res.body.healthy).toBe(false);
      expect(res.body.details.database).toBe("disconnected");
      expect(res.body.details.redis).toBe("timeout");
    });

    it("returns 503 when custom check throws", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          health: {
            check: () => {
              throw new Error("Database connection failed");
            },
          },
        })
      );
      const app = terrenoApp.build();

      const res = await supertest(app).get("/health").expect(503);
      expect(res.body.healthy).toBe(false);
      expect(res.body.details.error).toBe("Database connection failed");
    });

    it("supports async custom check", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          health: {
            check: async () => {
              await new Promise((resolve) => setTimeout(resolve, 10));
              return {
                details: {latency: "10ms"},
                healthy: true,
              };
            },
          },
        })
      );
      const app = terrenoApp.build();

      const res = await supertest(app).get("/health").expect(200);
      expect(res.body.healthy).toBe(true);
      expect(res.body.details.latency).toBe("10ms");
    });

    it("returns 503 when async check throws", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          health: {
            check: async () => {
              throw new Error("Async health check failed");
            },
          },
        })
      );
      const app = terrenoApp.build();

      const res = await supertest(app).get("/health").expect(503);
      expect(res.body.healthy).toBe(false);
      expect(res.body.details.error).toBe("Async health check failed");
    });

    it("returns 503 when async check rejects", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          health: {
            check: () => Promise.reject(new Error("Connection refused")),
          },
        })
      );
      const app = terrenoApp.build();

      const res = await supertest(app).get("/health").expect(503);
      expect(res.body.healthy).toBe(false);
      expect(res.body.details.error).toBe("Connection refused");
    });

    it("supports custom check with minimal details", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          health: {
            check: () => ({healthy: true}),
          },
        })
      );
      const app = terrenoApp.build();

      const res = await supertest(app).get("/health").expect(200);
      expect(res.body.healthy).toBe(true);
      expect(res.body.details).toBeUndefined();
    });

    it("supports complex health check with multiple services", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          health: {
            check: async () => {
              const dbConnected = true;
              const cacheConnected = true;
              const queueConnected = false;

              return {
                details: {
                  cache: {latency: "2ms", status: "connected"},
                  database: {latency: "5ms", status: "connected"},
                  queue: {error: "timeout", status: "disconnected"},
                  uptime: process.uptime(),
                  version: "1.2.3",
                },
                healthy: dbConnected && cacheConnected && queueConnected,
              };
            },
          },
        })
      );
      const app = terrenoApp.build();

      const res = await supertest(app).get("/health").expect(503);
      expect(res.body.healthy).toBe(false);
      expect(res.body.details.database.status).toBe("connected");
      expect(res.body.details.cache.status).toBe("connected");
      expect(res.body.details.queue.status).toBe("disconnected");
      expect(res.body.details.version).toBe("1.2.3");
      expect(res.body.details.uptime).toBeGreaterThan(0);
    });

    it("custom check at custom path works together", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          health: {
            check: () => ({
              details: {service: "terreno"},
              healthy: true,
            }),
            path: "/_status",
          },
        })
      );
      const app = terrenoApp.build();

      // Default path should not work
      await supertest(app).get("/health").expect(404);

      // Custom path should work
      const res = await supertest(app).get("/_status").expect(200);
      expect(res.body.healthy).toBe(true);
      expect(res.body.details.service).toBe("terreno");
    });
  });

  describe("health endpoint with other routes", () => {
    it("health endpoint coexists with model routers", async () => {
      const {FoodModel} = await import("./tests");
      const {Permissions} = await import("./permissions");

      const terrenoApp = TerrenoApp.create(createTestOptions());
      terrenoApp.addModelRouter("/food", FoodModel, {
        allowAnonymous: true,
        permissions: {
          create: [Permissions.IsAny],
          delete: [Permissions.IsAny],
          list: [Permissions.IsAny],
          read: [Permissions.IsAny],
          update: [Permissions.IsAny],
        },
      });
      const app = terrenoApp.build();

      // Health should work
      const healthRes = await supertest(app).get("/health").expect(200);
      expect(healthRes.body.healthy).toBe(true);

      // Model router should also work
      const foodRes = await supertest(app).get("/food").expect(200);
      expect(foodRes.body.data).toBeDefined();
    });

    it("health endpoint coexists with custom routes", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      terrenoApp.addRoute("/api", (router) => {
        router.get("/status", (_req, res) => res.json({status: "ok"}));
      });
      const app = terrenoApp.build();

      // Health should work
      const healthRes = await supertest(app).get("/health").expect(200);
      expect(healthRes.body.healthy).toBe(true);

      // Custom route should also work
      const customRes = await supertest(app).get("/api/status").expect(200);
      expect(customRes.body.status).toBe("ok");
    });
  });

  describe("health with different HTTP methods", () => {
    it("only responds to GET requests", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const app = terrenoApp.build();

      // GET should work
      await supertest(app).get("/health").expect(200);

      // POST should not match the health endpoint
      const _postRes = await supertest(app)
        .post("/health")
        .expect((res) => {
          expect(res.status).not.toBe(200);
        });
    });
  });

  describe("health endpoint response format", () => {
    it("default response is a simple JSON object", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const app = terrenoApp.build();

      const res = await supertest(app).get("/health").expect(200);
      expect(Object.keys(res.body)).toEqual(["healthy"]);
      expect(res.body.healthy).toBe(true);
    });

    it("custom check response preserves all detail keys", async () => {
      const details = {
        database: "connected",
        elasticsearch: "connected",
        memoryUsage: {heapUsed: 50, rss: 100},
        nodeVersion: process.version,
        redis: "connected",
        version: "3.0.0",
        workerQueue: "running",
      };

      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          health: {
            check: () => ({details, healthy: true}),
          },
        })
      );
      const app = terrenoApp.build();

      const res = await supertest(app).get("/health").expect(200);
      expect(res.body.details).toEqual(details);
    });
  });
});
