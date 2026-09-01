/**
 * Better Auth client configuration for the example frontend.
 */

import {baseUrl, createBetterAuthClient} from "@terreno/rtk";
import Constants from "expo-constants";

const getAppScheme = (): string => {
  const expoExtra = Constants.expoConfig?.extra;
  return expoExtra?.scheme ?? "frontend";
};

// `baseUrl` from @terreno/rtk is the single source of truth every other caller
// (RTK Query, sockets, syncdb) already uses. A separate resolver here previously
// fell back to `extra.BASE_URL` (localhost:4000) in dev, which points at the
// device itself on an Android emulator instead of the host machine.
export const betterAuthClient = createBetterAuthClient({
  baseURL: baseUrl,
  scheme: getAppScheme(),
  storagePrefix: "terreno-example",
});

export const signInWithSocial = async (provider: "google" | "github" | "apple"): Promise<void> => {
  await betterAuthClient.signIn.social({provider});
};

export const signInWithEmail = async (email: string, password: string): Promise<void> => {
  await betterAuthClient.signIn.email({email, password});
};

export const signUpWithEmail = async (
  email: string,
  password: string,
  name: string
): Promise<void> => {
  await betterAuthClient.signUp.email({email, name, password});
};

export const signOut = async (): Promise<void> => {
  await betterAuthClient.signOut();
};

interface BetterAuthActionResult {
  error?: {message?: string} | null;
}

export const getPasswordResetRedirectUrl = (): string => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/resetPassword`;
  }
  return `${getAppScheme()}://resetPassword`;
};

export const requestPasswordReset = async (email: string): Promise<BetterAuthActionResult> => {
  const result = await betterAuthClient.$fetch("/request-password-reset", {
    body: {email, redirectTo: getPasswordResetRedirectUrl()},
    method: "POST",
  });
  return {error: result.error};
};

export const resetPasswordWithToken = async ({
  newPassword,
  token,
}: {
  newPassword: string;
  token: string;
}): Promise<BetterAuthActionResult> => {
  const result = await betterAuthClient.$fetch("/reset-password", {
    body: {newPassword, token},
    method: "POST",
  });
  return {error: result.error};
};

export const sendVerificationEmail = async (email: string): Promise<BetterAuthActionResult> => {
  const callbackURL =
    typeof window !== "undefined" && window.location?.origin
      ? `${window.location.origin}/`
      : `${getAppScheme()}://`;
  const result = await betterAuthClient.$fetch("/send-verification-email", {
    body: {callbackURL, email},
    method: "POST",
  });
  return {error: result.error};
};

export const getSession = async () => {
  return betterAuthClient.getSession();
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Number of `getSession()` attempts `getSessionToken()` makes before giving up.
 * Callers (e.g. `useSocketConnection`'s `getAuthToken`) only call this once they
 * believe the user is signed in — right after login/session-sync resolved a userId
 * into Redux — so an empty session on the first attempt is more likely a transient
 * race (the freshly-set session cookie not yet consistently queryable) than a real
 * signed-out state. `useSocketConnection` has no retry of its own for this case (its
 * token-refresh-driven reconnect only fires for the JWT auth slice, not Better Auth),
 * so a transient empty result here would otherwise leave the socket connection
 * permanently unattempted until some unrelated effect re-triggers it.
 */
const GET_SESSION_TOKEN_RETRY_ATTEMPTS = 3;
const GET_SESSION_TOKEN_RETRY_DELAY_MS = 250;

export const getSessionToken = async (): Promise<string | null> => {
  for (let attempt = 1; attempt <= GET_SESSION_TOKEN_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const result = await betterAuthClient.getSession();
      const envelope = (result as {data?: {session?: {token?: string}}})?.data ?? result;
      const token = (envelope as {session?: {token?: string}})?.session?.token ?? null;
      if (token || attempt === GET_SESSION_TOKEN_RETRY_ATTEMPTS) {
        return token;
      }
    } catch {
      if (attempt === GET_SESSION_TOKEN_RETRY_ATTEMPTS) {
        return null;
      }
    }
    await sleep(GET_SESSION_TOKEN_RETRY_DELAY_MS);
  }
  return null;
};
