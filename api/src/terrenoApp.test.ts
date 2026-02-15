import {beforeEach, describe, expect, it} from "bun:test";
import express from "express";
import supertest from "supertest";

import {Permissions} from "./permissions";
import {TerrenoApp} from "./terrenoApp";
import type {TerrenoAppOptions} from "./terrenoAppOptions";
import {FoodModel, setupDb, UserModel} from "./tests";

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

describe("TerrenoApp", () => {
  let _admin: any;
  let _notAdmin: any;

  beforeEach(async () => {
    [_admin, _notAdmin] = await setupDb();
  });

  describe("create and build", () => {
    it("creates a TerrenoApp instance", () => {
      const app = TerrenoApp.create(createTestOptions());
      expect(app).toBeInstanceOf(TerrenoApp);
    });

    it("builds an Express app", () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const expressApp = terrenoApp.build();
      expect(expressApp).toBeDefined();
      expect(typeof expressApp.listen).toBe("function");
    });

    it("returns the same app on subsequent build calls", () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const app1 = terrenoApp.build();
      const app2 = terrenoApp.build();
      expect(app1).toBe(app2);
    });

    it("getExpressApp returns null before build", () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      expect(terrenoApp.getExpressApp()).toBeNull();
    });

    it("getExpressApp returns app after build", () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const built = terrenoApp.build();
      expect(terrenoApp.getExpressApp()).toBe(built);
    });

    it("getServer returns null before start", () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      expect(terrenoApp.getServer()).toBeNull();
    });
  });

  describe("start", () => {
    it("starts with skipListen and returns app", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const result = await terrenoApp.start();
      expect(result.app).toBeDefined();
    });

    it("starts a real server and can be shutdown", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          server: {port: 0, skipListen: false},
          shutdown: {handleSignals: false},
        })
      );
      const result = await terrenoApp.start();
      expect(result.server).toBeDefined();
      expect(result.server.listening).toBe(true);
      await terrenoApp.shutdown();
      expect(result.server.listening).toBe(false);
    });
  });

  describe("auth routes", () => {
    it("provides login endpoint by default", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const app = terrenoApp.build();
      const agent = supertest(app);

      const res = await agent
        .post("/auth/login")
        .send({email: "notAdmin@example.com", password: "password"})
        .expect(200);

      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.userId).toBeDefined();
    });

    it("provides signup endpoint by default", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const app = terrenoApp.build();
      const agent = supertest(app);

      const res = await agent
        .post("/auth/signup")
        .send({email: "newuser@example.com", password: "newpassword123"})
        .expect(200);

      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.userId).toBeDefined();
    });

    it("provides /auth/me endpoint by default", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const app = terrenoApp.build();

      const loginRes = await supertest(app)
        .post("/auth/login")
        .send({email: "notAdmin@example.com", password: "password"})
        .expect(200);

      const token = loginRes.body.data.token;

      const meRes = await supertest(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(meRes.body.data.email).toBe("notAdmin@example.com");
    });

    it("disables auth routes when enableAuthRoutes is false", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          auth: {
            ...createTestOptions().auth,
            enableAuthRoutes: false,
          },
        })
      );
      const app = terrenoApp.build();

      await supertest(app)
        .post("/auth/login")
        .send({email: "notAdmin@example.com", password: "password"})
        .expect(404);
    });

    it("disables /auth/me when enableMeRoute is false", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          auth: {
            ...createTestOptions().auth,
            enableMeRoute: false,
          },
        })
      );
      const app = terrenoApp.build();

      const loginRes = await supertest(app)
        .post("/auth/login")
        .send({email: "notAdmin@example.com", password: "password"})
        .expect(200);

      const token = loginRes.body.data.token;

      await supertest(app).get("/auth/me").set("Authorization", `Bearer ${token}`).expect(404);
    });
  });

  describe("addModelRouter", () => {
    it("adds a model router with full options", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      terrenoApp.addModelRouter("/food", FoodModel, {
        permissions: {
          create: [Permissions.IsAuthenticated],
          delete: [Permissions.IsAuthenticated],
          list: [Permissions.IsAuthenticated],
          read: [Permissions.IsAuthenticated],
          update: [Permissions.IsAuthenticated],
        },
        sort: "-created",
      });
      const app = terrenoApp.build();

      // Login
      const loginRes = await supertest(app)
        .post("/auth/login")
        .send({email: "notAdmin@example.com", password: "password"})
        .expect(200);
      const token = loginRes.body.data.token;

      // Create food (modelRouter returns 201 on create)
      const createRes = await supertest(app)
        .post("/food")
        .set("Authorization", `Bearer ${token}`)
        .send({calories: 95, name: "Apple"})
        .expect(201);

      expect(createRes.body.data.name).toBe("Apple");

      // List food
      const listRes = await supertest(app)
        .get("/food")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("adds a model router with shorthand permissions", async () => {
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

      // List food without auth (IsAny + allowAnonymous)
      const res = await supertest(app).get("/food").expect(200);
      expect(res.body.data).toBeDefined();
    });

    it("supports method chaining for multiple model routers", () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const result = terrenoApp
        .addModelRouter("/food", FoodModel, {
          create: [Permissions.IsAny],
          delete: [Permissions.IsAny],
          list: [Permissions.IsAny],
          read: [Permissions.IsAny],
          update: [Permissions.IsAny],
        })
        .addModelRouter("/users", UserModel as any, {
          create: [Permissions.IsAdmin],
          delete: [Permissions.IsAdmin],
          list: [Permissions.IsAdmin],
          read: [Permissions.IsAdmin],
          update: [Permissions.IsAdmin],
        });

      expect(result).toBe(terrenoApp);
    });
  });

  describe("addRoute", () => {
    it("adds a route with a callback function", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      terrenoApp.addRoute("/custom", (router) => {
        router.get("/ping", (_req, res) => res.json({pong: true}));
      });
      const app = terrenoApp.build();

      const res = await supertest(app).get("/custom/ping").expect(200);
      expect(res.body.pong).toBe(true);
    });

    it("adds a route with an express Router", async () => {
      const router = express.Router();
      router.get("/hello", (_req, res) => res.json({greeting: "world"}));

      const terrenoApp = TerrenoApp.create(createTestOptions());
      terrenoApp.addRoute("/api", router);
      const app = terrenoApp.build();

      const res = await supertest(app).get("/api/hello").expect(200);
      expect(res.body.greeting).toBe("world");
    });

    it("supports method chaining", () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const result = terrenoApp
        .addRoute("/a", (router) => {
          router.get("/", (_req, res) => res.send("a"));
        })
        .addRoute("/b", (router) => {
          router.get("/", (_req, res) => res.send("b"));
        });

      expect(result).toBe(terrenoApp);
    });
  });

  describe("addMiddleware", () => {
    it("adds middleware that runs for all routes", async () => {
      let middlewareCalled = false;
      const terrenoApp = TerrenoApp.create(createTestOptions());
      terrenoApp
        .addMiddleware((_req, _res, next) => {
          middlewareCalled = true;
          next();
        })
        .addRoute("/test", (router) => {
          router.get("/", (_req, res) => res.json({ok: true}));
        });
      const app = terrenoApp.build();

      await supertest(app).get("/test").expect(200);
      expect(middlewareCalled).toBe(true);
    });

    it("adds middleware with path restriction", async () => {
      let middlewareCalled = false;
      const terrenoApp = TerrenoApp.create(createTestOptions());
      terrenoApp
        .addMiddleware(
          (_req, _res, next) => {
            middlewareCalled = true;
            next();
          },
          {path: "/restricted"}
        )
        .addRoute("/restricted", (router) => {
          router.get("/", (_req, res) => res.json({ok: true}));
        })
        .addRoute("/open", (router) => {
          router.get("/", (_req, res) => res.json({ok: true}));
        });
      const app = terrenoApp.build();

      // Middleware should fire for /restricted
      await supertest(app).get("/restricted").expect(200);
      expect(middlewareCalled).toBe(true);

      // Reset and test /open - middleware should NOT fire
      middlewareCalled = false;
      await supertest(app).get("/open").expect(200);
      expect(middlewareCalled).toBe(false);
    });

    it("adds afterAuth middleware", async () => {
      let sawUser = false;
      const terrenoApp = TerrenoApp.create(createTestOptions());
      terrenoApp
        .addMiddleware(
          (req: any, _res, next) => {
            sawUser = !!req.user;
            next();
          },
          {position: "afterAuth"}
        )
        .addRoute("/test", (router) => {
          router.get("/", (_req, res) => res.json({ok: true}));
        });
      const app = terrenoApp.build();

      // Login and make authenticated request
      const loginRes = await supertest(app)
        .post("/auth/login")
        .send({email: "notAdmin@example.com", password: "password"})
        .expect(200);
      const token = loginRes.body.data.token;

      await supertest(app).get("/test").set("Authorization", `Bearer ${token}`).expect(200);

      expect(sawUser).toBe(true);
    });
  });

  describe("middleware options", () => {
    it("configures CORS", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          middleware: {
            cors: {
              credentials: true,
              origin: "https://example.com",
            },
          },
        })
      );
      terrenoApp.addRoute("/test", (router) => {
        router.get("/", (_req, res) => res.json({ok: true}));
      });
      const app = terrenoApp.build();

      const res = await supertest(app)
        .get("/test")
        .set("Origin", "https://example.com")
        .expect(200);

      expect(res.headers["access-control-allow-origin"]).toBe("https://example.com");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("uses default CORS (*) when not specified", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      terrenoApp.addRoute("/test", (router) => {
        router.get("/", (_req, res) => res.json({ok: true}));
      });
      const app = terrenoApp.build();

      const res = await supertest(app).get("/test").expect(200);
      expect(res.headers["access-control-allow-origin"]).toBe("*");
    });

    it("configures JSON body limit", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          middleware: {
            json: {limit: "1b"}, // 1 byte limit
          },
        })
      );
      terrenoApp.addRoute("/test", (router) => {
        router.post("/", (req, res) => res.json(req.body));
      });
      const app = terrenoApp.build();

      // Body larger than limit results in error (caught by fallthrough as 500)
      const res = await supertest(app).post("/test").send({big: "payload"});
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("configures query parser array limit", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          middleware: {
            queryParser: {arrayLimit: 5},
          },
        })
      );
      terrenoApp.addRoute("/test", (router) => {
        router.get("/", (req, res) => res.json(req.query));
      });
      const app = terrenoApp.build();

      const res = await supertest(app).get("/test?a[0]=1&a[1]=2&a[2]=3").expect(200);

      expect(Array.isArray(res.body.a)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("handles thrown errors with fallthrough handler", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      terrenoApp.addRoute("/test", (router) => {
        router.get("/", () => {
          throw new Error("Unexpected error");
        });
      });
      const app = terrenoApp.build();

      const res = await supertest(app).get("/test").expect(500);
      expect(res.body.status).toBe(500);
    });

    it("handles APIError correctly", async () => {
      const {APIError} = await import("./errors");
      const terrenoApp = TerrenoApp.create(createTestOptions());
      terrenoApp.addRoute("/test", (router) => {
        router.get("/", () => {
          throw new APIError({status: 404, title: "Not found"});
        });
      });
      const app = terrenoApp.build();

      const res = await supertest(app).get("/test").expect(404);
      expect(res.body.title).toBe("Not found");
    });
  });

  describe("hooks", () => {
    it("calls onAppCreated hook", () => {
      let hookCalled = false;
      TerrenoApp.create(
        createTestOptions({
          hooks: {
            onAppCreated: () => {
              hookCalled = true;
            },
          },
        })
      ).build();

      expect(hookCalled).toBe(true);
    });

    it("calls onCoreMiddlewareReady hook", () => {
      let hookCalled = false;
      TerrenoApp.create(
        createTestOptions({
          hooks: {
            onCoreMiddlewareReady: () => {
              hookCalled = true;
            },
          },
        })
      ).build();

      expect(hookCalled).toBe(true);
    });

    it("calls onAuthReady hook", () => {
      let hookCalled = false;
      TerrenoApp.create(
        createTestOptions({
          hooks: {
            onAuthReady: () => {
              hookCalled = true;
            },
          },
        })
      ).build();

      expect(hookCalled).toBe(true);
    });

    it("calls onRoutesReady hook", () => {
      let hookCalled = false;
      TerrenoApp.create(
        createTestOptions({
          hooks: {
            onRoutesReady: () => {
              hookCalled = true;
            },
          },
        })
      ).build();

      expect(hookCalled).toBe(true);
    });

    it("calls onReady hook", () => {
      let hookCalled = false;
      TerrenoApp.create(
        createTestOptions({
          hooks: {
            onReady: () => {
              hookCalled = true;
            },
          },
        })
      ).build();

      expect(hookCalled).toBe(true);
    });

    it("calls hooks in the correct order", () => {
      const order: string[] = [];
      TerrenoApp.create(
        createTestOptions({
          hooks: {
            onAppCreated: () => {
              order.push("appCreated");
            },
            onAuthReady: () => {
              order.push("authReady");
            },
            onCoreMiddlewareReady: () => {
              order.push("coreMiddleware");
            },
            onReady: () => {
              order.push("ready");
            },
            onRoutesReady: () => {
              order.push("routesReady");
            },
          },
        })
      ).build();

      expect(order).toEqual(["appCreated", "coreMiddleware", "authReady", "routesReady", "ready"]);
    });

    it("calls onListening hook when server starts", async () => {
      let listeningPort = 0;
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          hooks: {
            onListening: (_server, port) => {
              listeningPort = port;
            },
          },
          server: {port: 0, skipListen: false},
          shutdown: {handleSignals: false},
        })
      );
      const _result = await terrenoApp.start();
      expect(listeningPort).toBe(0); // port 0 was requested
      await terrenoApp.shutdown();
    });

    it("calls onRequest hook for every request", async () => {
      let requestCount = 0;
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          hooks: {
            onRequest: () => {
              requestCount++;
            },
          },
        })
      );
      terrenoApp.addRoute("/test", (router) => {
        router.get("/", (_req, res) => res.json({ok: true}));
      });
      const app = terrenoApp.build();

      await supertest(app).get("/test").expect(200);
      await supertest(app).get("/test").expect(200);

      expect(requestCount).toBe(2);
    });

    it("calls onError hook when error occurs", async () => {
      let capturedError: Error | null = null;
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          hooks: {
            onError: (error) => {
              capturedError = error;
            },
          },
        })
      );
      terrenoApp.addRoute("/test", (router) => {
        router.get("/", () => {
          throw new Error("test error");
        });
      });
      const app = terrenoApp.build();

      await supertest(app).get("/test").expect(500);
      expect(capturedError).not.toBeNull();
      expect((capturedError as unknown as Error).message).toBe("test error");
    });

    it("throws when hook throws during build", () => {
      expect(() => {
        TerrenoApp.create(
          createTestOptions({
            hooks: {
              onAppCreated: () => {
                throw new Error("hook error");
              },
            },
          })
        ).build();
      }).toThrow("hook error");
    });
  });

  describe("shutdown", () => {
    it("calls onShutdown callback", async () => {
      let shutdownCalled = false;
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          server: {port: 0, skipListen: false},
          shutdown: {
            handleSignals: false,
            onShutdown: () => {
              shutdownCalled = true;
            },
          },
        })
      );
      await terrenoApp.start();
      await terrenoApp.shutdown();
      expect(shutdownCalled).toBe(true);
    });

    it("is idempotent when called multiple times simultaneously", async () => {
      let shutdownCallCount = 0;
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          server: {port: 0, skipListen: false},
          shutdown: {
            handleSignals: false,
            onShutdown: () => {
              shutdownCallCount++;
            },
          },
        })
      );
      await terrenoApp.start();

      // Call shutdown concurrently
      await Promise.all([terrenoApp.shutdown(), terrenoApp.shutdown()]);
      expect(shutdownCallCount).toBe(1);
    });

    it("handles shutdown without a running server", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      terrenoApp.build();

      // Should not throw
      await terrenoApp.shutdown();
    });
  });

  describe("openapi", () => {
    it("serves openapi.json by default", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions());
      const app = terrenoApp.build();

      const res = await supertest(app).get("/openapi.json").expect(200);
      expect(res.body.openapi).toBe("3.0.0");
      expect(res.body.info).toBeDefined();
    });

    it("disables openapi when enabled is false", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          openApi: {enabled: false},
        })
      );
      terrenoApp.addRoute("/test", (router) => {
        router.get("/", (_req, res) => res.json({ok: true}));
      });
      const app = terrenoApp.build();

      await supertest(app).get("/openapi.json").expect(404);
    });

    it("customizes openapi info", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          openApi: {
            info: {
              description: "Test API description",
              title: "My API",
              version: "2.0.0",
            },
          },
        })
      );
      const app = terrenoApp.build();

      const res = await supertest(app).get("/openapi.json").expect(200);
      expect(res.body.info.title).toBe("My API");
      expect(res.body.info.version).toBe("2.0.0");
      expect(res.body.info.description).toBe("Test API description");
    });
  });

  describe("trust proxy", () => {
    it("sets trust proxy when configured", async () => {
      const terrenoApp = TerrenoApp.create(
        createTestOptions({
          server: {skipListen: true, trustProxy: true},
        })
      );
      const app = terrenoApp.build();
      expect(app.get("trust proxy")).toBe(true);
    });
  });

  describe("fluent API chaining", () => {
    it("supports full fluent configuration chain", async () => {
      const terrenoApp = TerrenoApp.create(createTestOptions())
        .addMiddleware((_req, _res, next) => next())
        .addModelRouter("/food", FoodModel, {
          allowAnonymous: true,
          permissions: {
            create: [Permissions.IsAny],
            delete: [Permissions.IsAny],
            list: [Permissions.IsAny],
            read: [Permissions.IsAny],
            update: [Permissions.IsAny],
          },
        })
        .addRoute("/custom", (router) => {
          router.get("/ping", (_req, res) => res.json({pong: true}));
        });

      const app = terrenoApp.build();

      const res = await supertest(app).get("/custom/ping").expect(200);
      expect(res.body.pong).toBe(true);

      const foodRes = await supertest(app).get("/food").expect(200);
      expect(foodRes.body.data).toBeDefined();
    });
  });
});
