import {
  APIError,
  BetterAuthApp,
  logger,
  syncBetterAuthUser,
  type UserModel as TerrenoAuthUserModel,
} from "@terreno/api";
import express from "express";
import {DateTime} from "luxon";
import supertest from "supertest";

import {User} from "../models/user";
import {buildBetterAuthConfig} from "./betterAuthConfig";

export interface BetterAuthSeedUser {
  email: string;
  name: string;
  password: string;
}

/**
 * Seed a Better Auth user in-process (no running server required).
 * Creates the credential account and syncs the Mongoose User row.
 */
export const seedBetterAuthUserInProcess = async (
  user: BetterAuthSeedUser
): Promise<{cookie: string; token: string}> => {
  const config = buildBetterAuthConfig();
  if (!config) {
    throw new APIError({
      status: 500,
      title: "seedBetterAuthUserInProcess requires AUTH_PROVIDER=better-auth",
    });
  }

  const app = express();
  app.use(express.json());
  const betterAuthApp = new BetterAuthApp({
    config,
    userModel: User as unknown as TerrenoAuthUserModel,
  });
  betterAuthApp.register(app);
  const agent = supertest(app);

  const signUpRes = await agent.post("/api/auth/sign-up/email").send({
    email: user.email,
    name: user.name,
    password: user.password,
  });

  let response = signUpRes;
  if (!signUpRes.ok) {
    response = await agent.post("/api/auth/sign-in/email").send({
      email: user.email,
      password: user.password,
    });
  }
  if (!response.ok) {
    throw new APIError({
      status: 500,
      title: `Better Auth seed failed for ${user.email}: ${response.status} ${response.text}`,
    });
  }

  const setCookie = response.headers["set-cookie"];
  const cookie = Array.isArray(setCookie)
    ? setCookie.map((value) => value.split(";")[0]).join("; ")
    : typeof setCookie === "string"
      ? setCookie.split(";")[0]
      : "";
  const body = response.body as {
    session?: {token?: string};
    token?: string;
    user?: {email: string; id: string; name: string | null};
  };
  const token = body.session?.token ?? body.token ?? "";
  if (!cookie && !token) {
    throw new APIError({
      status: 500,
      title: `Better Auth seed for ${user.email} succeeded but returned no session`,
    });
  }

  if (body.user) {
    await syncBetterAuthUser(User as unknown as TerrenoAuthUserModel, {
      createdAt: DateTime.now().toJSDate(),
      email: body.user.email,
      emailVerified: false,
      id: body.user.id,
      image: null,
      name: body.user.name,
      updatedAt: DateTime.now().toJSDate(),
    });
  }

  logger.info(`Seeded Better Auth user in-process: ${user.email}`);
  return {cookie, token};
};
