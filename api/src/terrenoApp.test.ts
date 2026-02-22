import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import type express from "express";
import supertest from "supertest";

import {modelRouter} from "./api";
import {Permissions} from "./permissions";
import {TerrenoApp} from "./terrenoApp";
import type {TerrenoPlugin} from "./terrenoPlugin";
import {authAsUser, FoodModel, setupDb, UserModel} from "./tests";

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
        userModel: UserModel as any,
      }).build();

      expect(app).toBeDefined();
    });

    it("creates server with custom corsOrigin", () => {
      const app = new TerrenoApp({
        corsOrigin: "https://example.com",
        skipListen: true,
        userModel: UserModel as any,
      }).build();

      expect(app).toBeDefined();
    });
  });

  describe("start", () => {
    it("returns an express application with skipListen", () => {
      const app = new TerrenoApp({
        skipListen: true,
        userModel: UserModel as any,
      }).start();

      expect(app).toBeDefined();
    });
  });

  describe("register with modelRouter", () => {
    let admin: any;

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
        userModel: UserModel as any,
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
        userModel: UserModel as any,
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
        userModel: UserModel as any,
      })
        .register(plugin)
        .build();

      expect(registerFn).toHaveBeenCalledTimes(1);
      // Verify the plugin received the express app
      const calledWith = (registerFn.mock.calls as any[][])[0][0];
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
        userModel: UserModel as any,
      })
        .addMiddleware(middleware)
        .build();

      await supertest(app).get("/nonexistent").expect(404);
      expect(middlewareCalled).toBe(true);
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
      expect((result as any).__type).toBeUndefined();
    });
  });
});
