import type {Page} from "@playwright/test";
import {MongoClient} from "mongodb";
import {ADMIN_USER} from "../fixtures/testUsers";
import {loginAs} from "./login";

const MONGO_URI = process.env.MONGO_URI ?? "mongodb://127.0.0.1/terreno-e2e";
const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

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

export const getAdminToken = async (request: {
  post: (
    url: string,
    options?: Record<string, unknown>
  ) => Promise<{ok: () => boolean; json: () => Promise<unknown>}>;
}): Promise<string> => {
  const loginRes = await request.post(`${API_URL}/auth/login`, {
    data: {email: ADMIN_USER.email, password: ADMIN_USER.password},
  });
  if (!loginRes.ok()) {
    throw new Error("Failed to login as admin");
  }
  const loginData = (await loginRes.json()) as {data?: {token?: string}; token?: string};
  return loginData?.data?.token ?? loginData?.token ?? "";
};

export const loginAsAdmin = async (page: Page): Promise<void> => {
  await loginAs(page, ADMIN_USER);
};
