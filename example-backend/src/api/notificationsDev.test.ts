import {afterAll, beforeAll, beforeEach, describe, it} from "bun:test";
import {
  clearMCPRegistry,
  generateTokens,
  type ModelRouterOptions,
  type ModelRouterRegistration,
  Notification,
  NotificationsApp,
  TerrenoApp,
} from "@terreno/api";
import {assert} from "chai";
import express from "express";
import supertest from "supertest";
import {User as UserModel} from "../models/user";
import type {UserDocument} from "../types/models/userTypes";
import {addDevNotificationRoutes} from "./notificationsDev";

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

  return {
    __type: "modelRouter",
    _buildWithContext: ({openApi}) => buildRouter(openApi),
    model: {} as ModelRouterRegistration["model"],
    options: {} as ModelRouterRegistration["options"],
    path: "/",
    router: express.Router(),
  };
};

describe("dev notification route", () => {
  let app: ReturnType<TerrenoApp["build"]>;

  const buildApp = (): ReturnType<TerrenoApp["build"]> => {
    process.env.TOKEN_SECRET = process.env.TOKEN_SECRET || "test-secret";
    process.env.TOKEN_ISSUER = process.env.TOKEN_ISSUER || "example-backend-test";
    return new TerrenoApp({
      authOptions: {
        generateJWTPayload: (user: unknown) => ({
          admin: (user as {admin?: boolean}).admin === true,
        }),
      },
      skipListen: true,
      userModel: UserModel as never,
    })
      .register(new NotificationsApp({userModel: UserModel}))
      .register(createOpenApiAwareRouteRegistration(addDevNotificationRoutes))
      .build();
  };

  const createUser = async (email: string): Promise<{_id: UserDocument["_id"]}> => {
    return UserModel.register(
      {admin: false, email, name: email} as never,
      "password12345"
    ) as unknown as Promise<{
      _id: UserDocument["_id"];
    }>;
  };

  beforeAll(() => {
    app = buildApp();
  });

  afterAll(() => {
    clearMCPRegistry();
  });

  beforeEach(async () => {
    await Notification.collection.deleteMany({});
  });

  it("returns 401 without auth", async () => {
    const response = await supertest(app).post("/notifications/dev/notify").send({});
    assert.equal(response.status, 401);
  });

  it("creates a notification for the authenticated user", async () => {
    const user = await createUser("notify-dev@example.com");
    const {token} = await generateTokens(user);
    const response = await supertest(app)
      .post("/notifications/dev/notify")
      .set("Authorization", `Bearer ${token}`)
      .send({body: "Hello", title: "Test"});
    assert.equal(response.status, 200);
    assert.isNotEmpty(response.body.data.notificationId);
    const count = await Notification.countDocuments({ownerId: user._id});
    assert.equal(count, 1);
  });
});
