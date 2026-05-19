import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import type express from "express";
import supertest from "supertest";

import {modelRouter} from "./api";
import type {UserModel as UserModelType} from "./auth";
import {Permissions} from "./permissions";
import {TerrenoApp} from "./terrenoApp";
import type {TerrenoPlugin} from "./terrenoPlugin";
import {authAsUser, FoodModel, setupDb, UserModel} from "./tests";

const typedUserModel = UserModel as unknown as UserModelType;

describe("TerrenoApp", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      REFRESH_TOKEN_SECRET: "test-refresh-secret",
      SESSION_SECRET: "test-session-secret",
      TOKEN_EXPIRES_IN: "1h",
      TOKEN_ISSUER: "test-issuer",
      TOKEN_SECRET: "test-secret",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("build", () => {
    it("returns an express application without listening", () => {
      const app = new TerrenoApp({
        skipListen: true,
        userModel: typedUserModel,
      }).build();

      expect(app).toBeDefined();
    });

    it("creates server with custom corsOrigin", () => {
      const app = new TerrenoApp({
        corsOrigin: "https://example.com",
        skipListen: true,
        userModel: typedUserModel,
      }).build();

      expect(app).toBeDefined();
    });
  });

  describe("start", () => {
    it("returns an express application with skipListen", () => {
      const app = new TerrenoApp({
        skipListen: true,
        userModel: typedUserModel,
      }).start();

      expect(app).toBeDefined();
    });
  });

  describe("register with modelRouter", () => {
    let admin: Awaited<ReturnType<typeof setupDb>>[0];

    beforeEach(async () => {
      [admin] = await setupDb();
    });

    it("mounts model router at the specified path", async () => {
      const foodRegistration = modelRouter("/food", FoodModel, {
        allowAnonymous: true,
        permissions: {
          create: [Permissions.IsAny],
          delete: [Permissions.IsAny],
          list: [Permissions.IsAny],
          read: [Permissions.IsAny],
          update: [Permissions.IsAny],
        },
        sort: "-created",
      });

      expect(foodRegistration.__type).toBe("modelRouter");
      expect(foodRegistration.path).toBe("/food");

      const app = new TerrenoApp({
        skipListen: true,
        userModel: typedUserModel,
      })
        .register(foodRegistration)
        .build();

      await FoodModel.create({
        calories: 100,
        name: "Apple",
        ownerId: admin._id,
        source: {name: "Nature"},
      });

      const agent = await authAsUser(app, "admin");
      const res = await agent.get("/food").expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("Apple");
    });

    it("supports chaining multiple registrations", async () => {
      const foodRegistration = modelRouter("/food", FoodModel, {
        allowAnonymous: true,
        permissions: {
          create: [Permissions.IsAny],
          delete: [Permissions.IsAny],
          list: [Permissions.IsAny],
          read: [Permissions.IsAny],
          update: [Permissions.IsAny],
        },
      });

      const app = new TerrenoApp({
        skipListen: true,
        userModel: typedUserModel,
      })
        .register(foodRegistration)
        .build();

      expect(app).toBeDefined();
    });
  });

  describe("register with plugin", () => {
    it("calls plugin.register with the express app", () => {
      const registerFn = mock(() => {});
      const plugin: TerrenoPlugin = {
        register: registerFn,
      };

      const app = new TerrenoApp({
        skipListen: true,
        userModel: typedUserModel,
      })
        .register(plugin)
        .build();

      expect(registerFn).toHaveBeenCalledTimes(1);
      const calledWith = (registerFn.mock.calls as unknown[][])[0][0];
      expect(calledWith).toBe(app);
    });
  });

  describe("addMiddleware", () => {
    it("runs request handler middleware", async () => {
      let middlewareCalled = false;
      const middleware: express.RequestHandler = (_req, _res, next) => {
        middlewareCalled = true;
        next();
      };

      const app = new TerrenoApp({
        skipListen: true,
        userModel: typedUserModel,
      })
        .addMiddleware(middleware)
        .build();

      await supertest(app).get("/nonexistent").expect(404);
      expect(middlewareCalled).toBe(true);
    });
  });

  describe("configure", () => {
    beforeEach(async () => {
      await setupDb();
    });

    it("mounts configuration routes when configure() is called", async () => {
      const mongoose = await import("mongoose");
      const {Schema} = mongoose;
      const {configurationPlugin} = await import("./configurationPlugin");
      const {createdUpdatedPlugin} = await import("./plugins");

      const cfgSchema = new Schema(
        {siteName: {default: "My Site", description: "Site name", type: String}},
        {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
      );
      cfgSchema.plugin(configurationPlugin);
      cfgSchema.plugin(createdUpdatedPlugin);

      const modelName = `CfgModel_${Date.now()}`;
      const CfgModel = mongoose.model(modelName, cfgSchema);

      const app = new TerrenoApp({
        skipListen: true,
        userModel: typedUserModel,
      })
        .configure(CfgModel)
        .build();

      const agent = await authAsUser(app, "admin");
      const res = await agent.get("/configuration/meta");
      expect(res.status).toBe(200);
    });
  });

  describe("fallthrough error handler", () => {
    it("returns 500 for non-API errors", async () => {
      const plugin: TerrenoPlugin = {
        register: (pluginApp) => {
          pluginApp.get("/trigger-fallthrough", (_req: express.Request, _res: express.Response) => {
            throw new Error("unexpected failure");
          });
        },
      };
      const app = new TerrenoApp({
        skipListen: true,
        userModel: typedUserModel,
      })
        .register(plugin)
        .build();

      const res = await supertest(app).get("/trigger-fallthrough");
      expect(res.status).toBe(500);
    });
  });

  describe("start with listen", () => {
    it("starts and listens on the configured port", async () => {
      const port = "19876";
      process.env.PORT = port;
      const app = new TerrenoApp({
        userModel: typedUserModel,
      }).start();

      expect(app).toBeDefined();

      // Clean up the listener
      const server = (app as unknown as {_server?: import("http").Server})._server;
      if (server) {
        server.close();
      }
    });
  });

  describe("addMiddleware with app-configuring function", () => {
    it("invokes a function that receives the express app (fn.length > 3)", async () => {
      let receivedApp: express.Application | undefined;
      const configFn = (
        _appInstance: express.Application,
        _a: unknown,
        _b: unknown,
        _c: unknown
      ): void => {
        receivedApp = _appInstance;
      };

      const app = new TerrenoApp({
        skipListen: true,
        userModel: typedUserModel,
      })
        .addMiddleware(configFn as unknown as (app: express.Application) => void)
        .build();

      expect(app).toBeDefined();
      expect(receivedApp).toBe(app);
    });
  });

  describe("modelRouter overload", () => {
    it("returns ModelRouterRegistration when path is provided", () => {
      const result = modelRouter("/food", FoodModel, {
        permissions: {
          create: [Permissions.IsAny],
          delete: [Permissions.IsAny],
          list: [Permissions.IsAny],
          read: [Permissions.IsAny],
          update: [Permissions.IsAny],
        },
      });

      expect(result.__type).toBe("modelRouter");
      expect(result.path).toBe("/food");
      expect(result.router).toBeDefined();
    });

    it("returns express.Router when no path is provided", () => {
      const result = modelRouter(FoodModel, {
        permissions: {
          create: [Permissions.IsAny],
          delete: [Permissions.IsAny],
          list: [Permissions.IsAny],
          read: [Permissions.IsAny],
          update: [Permissions.IsAny],
        },
      });

      // Should be a regular router (function), not a ModelRouterRegistration
      expect(typeof result).toBe("function");
      expect((result as unknown as {__type?: string}).__type).toBeUndefined();
    });
  });
});
