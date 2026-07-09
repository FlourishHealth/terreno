import {APIError, BetterAuthApp, logger, syncBetterAuthUser} from "@terreno/api";
import express from "express";
import supertest from "supertest";

import {User} from "../models/user";
import {buildBetterAuthConfig} from "./betterAuthConfig";

const DEFAULT_API_URL = "http://localhost:4000";

export interface BetterAuthSeedUser {
  email: string;
  name: string;
  password: string;
}

const extractCookieHeader = (res: Response): string | undefined => {
  const cookies = res.headers.getSetCookie();
  if (cookies.length === 0) {
    return undefined;
  }
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
};

/**
 * Sign a user up (or sign in if they already exist) through the running backend's
 * Better Auth email endpoints. Returns the session cookie header for follow-up
 * requests that should sync the user into the Mongoose User model.
 */
export const signUpOrSignInBetterAuthUser = async ({
  apiUrl = process.env.BETTER_AUTH_URL ?? process.env.API_URL ?? DEFAULT_API_URL,
  user,
}: {
  apiUrl?: string;
  user: BetterAuthSeedUser;
}): Promise<string> => {
  const signUpRes = await fetch(`${apiUrl}/api/auth/sign-up/email`, {
    body: JSON.stringify({email: user.email, name: user.name, password: user.password}),
    headers: {"Content-Type": "application/json"},
    method: "POST",
  });
  if (signUpRes.ok) {
    const cookie = extractCookieHeader(signUpRes);
    if (!cookie) {
      throw new APIError({
        status: 500,
        title: `Better Auth sign-up for ${user.email} succeeded but returned no session cookie`,
      });
    }
    logger.info(`Signed up Better Auth user: ${user.email}`);
    return cookie;
  }

  const signInRes = await fetch(`${apiUrl}/api/auth/sign-in/email`, {
    body: JSON.stringify({email: user.email, password: user.password}),
    headers: {"Content-Type": "application/json"},
    method: "POST",
  });
  if (!signInRes.ok) {
    const body = await signInRes.text();
    throw new APIError({
      status: 500,
      title: `Better Auth sign-up (${signUpRes.status}) and sign-in (${signInRes.status}) failed for ${user.email}: ${body}`,
    });
  }
  const cookie = extractCookieHeader(signInRes);
  if (!cookie) {
    throw new APIError({
      status: 500,
      title: `Better Auth sign-in for ${user.email} succeeded but returned no session cookie`,
    });
  }
  logger.info(`Signed in existing Better Auth user: ${user.email}`);
  return cookie;
};

/** Hit an authenticated route so Better Auth session middleware syncs into Mongoose. */
export const syncBetterAuthUserToMongoose = async ({
  apiUrl = process.env.BETTER_AUTH_URL ?? process.env.API_URL ?? DEFAULT_API_URL,
  cookie,
  token,
}: {
  apiUrl?: string;
  cookie?: string;
  token?: string;
}): Promise<void> => {
  const headers: Record<string, string> = {};
  if (cookie) {
    headers.cookie = cookie;
  }
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  await fetch(`${apiUrl}/auth/me`, {headers});
};

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
    // biome-ignore lint/suspicious/noExplicitAny: User model type mismatch
    userModel: User as any,
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
    await syncBetterAuthUser(
      // biome-ignore lint/suspicious/noExplicitAny: User model _id is ObjectId; api UserModel expects string | ObjectId
      User as any,
      {
        createdAt: new Date(),
        email: body.user.email,
        emailVerified: false,
        id: body.user.id,
        image: null,
        name: body.user.name,
        updatedAt: new Date(),
      }
    );
  }

  logger.info(`Seeded Better Auth user in-process: ${user.email}`);
  return {cookie, token};
};
