import type {APIRequestContext} from "@playwright/test";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
const FRONTEND_ORIGIN = process.env.FRONTEND_URL ?? "http://localhost:8082";

/**
 * Better Auth's origin-check middleware forces origin validation whenever a request
 * carries a `Cookie` header (see `validateOrigin` in better-auth's origin-check
 * middleware). Playwright's `request` fixture is a single shared cookie jar across an
 * entire test/setup file, so once any Better Auth call sets a session cookie, every
 * later call in that same context — sign-up or sign-in, for any user — automatically
 * forwards that cookie and must present a trusted `Origin` header or it 403s with
 * `MISSING_OR_NULL_ORIGIN`. Sending this on every request keeps auth.setup.ts's
 * multi-user loop working regardless of cookie state.
 */
const originHeaders = {origin: FRONTEND_ORIGIN};

export interface BetterAuthCredentials {
  email: string;
  name: string;
  password: string;
}

interface SessionEnvelope {
  session?: {token?: string};
  token?: string;
}

const readSessionToken = (body: unknown): string => {
  const envelope = body as {data?: SessionEnvelope} & SessionEnvelope;
  const session = envelope.data?.session ?? envelope.session;
  const token = session?.token ?? envelope.data?.token ?? envelope.token ?? "";
  if (!token) {
    throw new Error("Better Auth response did not include a session token");
  }
  return token;
};

/** Sign up (or sign in) via Better Auth and return a bearer token for API helpers. */
export const signUpOrSignInBetterAuth = async (
  request: APIRequestContext,
  user: BetterAuthCredentials
): Promise<string> => {
  const signUpRes = await request.post(`${API_URL}/api/auth/sign-up/email`, {
    data: {email: user.email, name: user.name, password: user.password},
    headers: originHeaders,
  });

  let token: string;
  if (signUpRes.ok()) {
    token = readSessionToken(await signUpRes.json());
  } else {
    const signInRes = await request.post(`${API_URL}/api/auth/sign-in/email`, {
      data: {email: user.email, password: user.password},
      headers: originHeaders,
    });
    if (!signInRes.ok()) {
      throw new Error(
        `Better Auth sign-up (${signUpRes.status()}) and sign-in (${signInRes.status()}) failed for ${user.email}`
      );
    }
    token = readSessionToken(await signInRes.json());
  }

  // Ensure the Mongoose User row exists for owner-scoped routes. The Better Auth session
  // middleware only creates it lazily on first authenticated request — without this, a
  // fresh sign-up returns a valid session token but leaves no User row for callers (e.g.
  // auth.setup.ts's setUserAdmin) that need to mutate the row immediately afterwards.
  await request.get(`${API_URL}/auth/me`, {
    headers: {authorization: `Bearer ${token}`, ...originHeaders},
  });
  return token;
};
