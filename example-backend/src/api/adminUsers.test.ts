import {beforeEach, describe, expect, it} from "bun:test";
import {
  generateTokens,
  type ModelRouterOptions,
  type ModelRouterRegistration,
  TerrenoApp,
} from "@terreno/api";
import express from "express";
import mongoose from "mongoose";
import supertest from "supertest";
import {User as UserModel} from "../models/user";
import type {UserDocument} from "../types/models/userTypes";
import {addAdminUserRoutes} from "./adminUsers";

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

describe("admin user password route", () => {
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
        createOpenApiAwareRouteRegistration(addAdminUserRoutes as RegisterRoutesWithOptions)
      )
      .build();
  };

  const createUser = async (
    email: string,
    admin: boolean
  ): Promise<{_id: UserDocument["_id"]; admin: boolean}> => {
    return UserModel.register(
      {admin, email, name: email} as never,
      "password12345"
    ) as unknown as Promise<{
      _id: UserDocument["_id"];
      admin: boolean;
    }>;
  };

  const tokenFor = async (user: {_id: UserDocument["_id"]; admin: boolean}): Promise<string> => {
    const {token} = await generateTokens(user as never);
    if (!token) {
      throw new Error("Failed to generate a token for test user");
    }
    return token;
  };

  beforeEach(async () => {
    await UserModel.deleteMany({});
  });

  it("returns 401 without authentication", async () => {
    const app = buildApp();
    const target = await createUser("target@example.com", false);
    await supertest(app)
      .post(`/admin/users/${target._id}/password`)
      .send({password: "newpassword1"})
      .expect(401);
  });

  it("returns 403 for a non-admin caller", async () => {
    const app = buildApp();
    const caller = await createUser("user@example.com", false);
    const target = await createUser("target@example.com", false);
    const token = await tokenFor(caller);
    await supertest(app)
      .post(`/admin/users/${target._id}/password`)
      .set("Authorization", `Bearer ${token}`)
      .send({password: "newpassword1"})
      .expect(403);
  });

  it("returns 400 when the password is too short", async () => {
    const app = buildApp();
    const admin = await createUser("admin@example.com", true);
    const target = await createUser("target@example.com", false);
    const token = await tokenFor(admin);
    await supertest(app)
      .post(`/admin/users/${target._id}/password`)
      .set("Authorization", `Bearer ${token}`)
      .send({password: "short"})
      .expect(400);
  });

  it("returns 404 when the user does not exist", async () => {
    const app = buildApp();
    const admin = await createUser("admin@example.com", true);
    const token = await tokenFor(admin);
    const missingId = new mongoose.Types.ObjectId();
    await supertest(app)
      .post(`/admin/users/${missingId}/password`)
      .set("Authorization", `Bearer ${token}`)
      .send({password: "newpassword1"})
      .expect(404);
  });

  it("returns 200 and updates the password for an admin caller", async () => {
    const app = buildApp();
    const admin = await createUser("admin@example.com", true);
    const target = await createUser("target@example.com", false);
    const token = await tokenFor(admin);
    const res = await supertest(app)
      .post(`/admin/users/${target._id}/password`)
      .set("Authorization", `Bearer ${token}`)
      .send({password: "newpassword1"})
      .expect(200);
    expect(res.body.data._id).toBe(String(target._id));
    expect(res.body.data.message).toBe("Password updated");
  });
});
