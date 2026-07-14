import type {APIRequestContext, Page} from "@playwright/test";
import {MongoClient} from "mongodb";
import {ADMIN_USER} from "../fixtures/testUsers";
import {signUpOrSignInBetterAuth} from "./betterAuthSession";
import {loginAs} from "./login";

const MONGO_URI = process.env.MONGO_URI ?? "mongodb://127.0.0.1/terreno-e2e";

export const setUserAdmin = async (email: string): Promise<void> => {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    await client
      .db()
      .collection("users")
      .updateOne({email}, {$set: {admin: true}});
  } finally {
    await client.close();
  }
};

export const getAdminToken = async (request: APIRequestContext): Promise<string> => {
  return signUpOrSignInBetterAuth(request, {
    email: ADMIN_USER.email,
    name: ADMIN_USER.name,
    password: ADMIN_USER.password,
  });
};

export const loginAsAdmin = async (page: Page): Promise<void> => {
  await loginAs(page, ADMIN_USER);
};
