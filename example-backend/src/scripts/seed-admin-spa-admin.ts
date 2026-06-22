/**
 * Seed a Better Auth admin user for the admin SPA integration e2e.
 *
 * Signs the user up through the running backend's Better Auth endpoint (so the
 * credential account exists), forces the session middleware to sync the user into
 * the Mongoose User model, then promotes that user to admin directly in the database.
 *
 * The backend must already be running with AUTH_PROVIDER=better-auth.
 *
 * Run with: bun run src/scripts/seed-admin-spa-admin.ts
 */

import {APIError, logger} from "@terreno/api";
import mongoose from "mongoose";
import {User} from "../models/user";
import {connectToMongoDB} from "../utils/database";

const API_URL = process.env.ADMIN_SPA_BACKEND_URL ?? "http://localhost:4000";
const ADMIN_EMAIL = process.env.ADMIN_SPA_E2E_EMAIL ?? "admin-spa-e2e@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_SPA_E2E_PASSWORD ?? "admin-spa-e2e-password";
const ADMIN_NAME = "Admin SPA E2E";

const extractCookieHeader = (res: Response): string | undefined => {
  const cookies = res.headers.getSetCookie();
  if (cookies.length === 0) {
    return undefined;
  }
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
};

const signUpOrSignIn = async (): Promise<string> => {
  const signUpRes = await fetch(`${API_URL}/api/auth/sign-up/email`, {
    body: JSON.stringify({email: ADMIN_EMAIL, name: ADMIN_NAME, password: ADMIN_PASSWORD}),
    headers: {"Content-Type": "application/json"},
    method: "POST",
  });
  if (signUpRes.ok) {
    const cookie = extractCookieHeader(signUpRes);
    if (!cookie) {
      throw new APIError({
        status: 500,
        title: "Better Auth sign-up succeeded but returned no session cookie",
      });
    }
    logger.info(`Signed up Better Auth user: ${ADMIN_EMAIL}`);
    return cookie;
  }

  // The user already exists (e.g. re-running locally) - sign in instead.
  const signInRes = await fetch(`${API_URL}/api/auth/sign-in/email`, {
    body: JSON.stringify({email: ADMIN_EMAIL, password: ADMIN_PASSWORD}),
    headers: {"Content-Type": "application/json"},
    method: "POST",
  });
  if (!signInRes.ok) {
    const body = await signInRes.text();
    throw new APIError({
      status: 500,
      title: `Better Auth sign-up (${signUpRes.status}) and sign-in (${signInRes.status}) both failed: ${body}`,
    });
  }
  const cookie = extractCookieHeader(signInRes);
  if (!cookie) {
    throw new APIError({
      status: 500,
      title: "Better Auth sign-in succeeded but returned no session cookie",
    });
  }
  logger.info(`Signed in existing Better Auth user: ${ADMIN_EMAIL}`);
  return cookie;
};

const main = async (): Promise<void> => {
  const cookie = await signUpOrSignIn();

  // Hit an authenticated route so the Better Auth session middleware syncs the user
  // into the Mongoose User model (created with admin: false). The 403 here is expected.
  await fetch(`${API_URL}/admin/config`, {headers: {cookie}});

  await connectToMongoDB();
  const result = await User.updateOne({email: ADMIN_EMAIL}, {$set: {admin: true}});
  if (result.matchedCount === 0) {
    throw new APIError({
      status: 404,
      title: `No User document found for ${ADMIN_EMAIL} - Better Auth sync did not run`,
    });
  }

  const user = await User.findByEmail(ADMIN_EMAIL);
  if (!user?.admin) {
    throw new APIError({status: 500, title: `Failed to promote ${ADMIN_EMAIL} to admin`});
  }
  logger.info(`Promoted ${ADMIN_EMAIL} to admin (id: ${user._id})`);

  await mongoose.disconnect();
  // The Configuration change stream opened by connectToMongoDB keeps the event
  // loop alive, so exit explicitly once seeding is complete.
  process.exit(0);
};

main().catch((error: unknown) => {
  logger.error(`Error seeding admin SPA e2e admin user: ${error}`);
  process.exit(1);
});
