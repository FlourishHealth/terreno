import type {APIRequestContext} from "@playwright/test";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

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
  });
  if (signUpRes.ok()) {
    return readSessionToken(await signUpRes.json());
  }

  const signInRes = await request.post(`${API_URL}/api/auth/sign-in/email`, {
    data: {email: user.email, password: user.password},
  });
  if (!signInRes.ok()) {
    throw new Error(
      `Better Auth sign-up (${signUpRes.status()}) and sign-in (${signInRes.status()}) failed for ${user.email}`
    );
  }
  const token = readSessionToken(await signInRes.json());
  // Ensure the Mongoose User row exists for owner-scoped routes.
  await request.get(`${API_URL}/auth/me`, {
    headers: {authorization: `Bearer ${token}`},
  });
  return token;
};
