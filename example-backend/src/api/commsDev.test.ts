import {beforeEach, describe, it} from "bun:test";
import {
  generateTokens,
  type ModelRouterOptions,
  type ModelRouterRegistration,
  TerrenoApp,
} from "@terreno/api";
import {CommsApp, PushToken} from "@terreno/comms";
import {assert} from "chai";
import express from "express";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import supertest from "supertest";
import {User as UserModel} from "../models/user";
import type {UserDocument} from "../types/models/userTypes";
import {addDevCommsRoutes} from "./commsDev";

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
    _buildWithContext: ({openApi}) => buildRouter(openApi),
    model: {} as ModelRouterRegistration["model"],
    options: {} as ModelRouterRegistration["options"],
    path: "/",
    router: express.Router(),
  };
  return registration;
};

describe("dev comms test-push route", () => {
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
      userModel: UserModel as never,
    })
      .register(
        new CommsApp({
          push: {
            id: "memory-push",
            sendPush: async (message) =>
              message.tokens.map((token) => ({
                accepted: true,
                providerMessageId: `mem-${token}`,
              })),
          },
        })
      )
      .register(createOpenApiAwareRouteRegistration(addDevCommsRoutes))
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

  const tokenFor = async (user: {_id: UserDocument["_id"]}): Promise<string> => {
    const {token} = await generateTokens(user as never);
    if (!token) {
      throw new Error("Failed to generate a token for test user");
    }
    return token;
  };

  beforeEach(async () => {
    await UserModel.deleteMany({});
    await PushToken.deleteMany({});
  });

  it("rejects an unauthenticated request with 401", async () => {
    const app = buildApp();
    const res = await supertest(app).post("/comms/dev/testPush").send({});
    assert.equal(res.status, 401);
  });

  it("sends a test push to the caller's registered tokens", async () => {
    const app = buildApp();
    const user = await createUser("push-user@example.com");
    const token = await tokenFor(user);
    await PushToken.create({
      active: true,
      lastSeenAt: DateTime.utc().toJSDate(),
      platform: "ios",
      token: "ExponentPushToken[dev-test]",
      userId: new mongoose.Types.ObjectId(String(user._id)),
    });

    const res = await supertest(app)
      .post("/comms/dev/testPush")
      .set("Authorization", `Bearer ${token}`)
      .send({body: "World", title: "Hello"});

    assert.equal(res.status, 200);
    assert.equal(res.body.data.tokenCount, 1);
    assert.equal(res.body.data.accepted, 1);
  });
});
