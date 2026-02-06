/**
 * Better Auth client configuration for the example frontend.
 *
 * This module provides the Better Auth client instance when AUTH_PROVIDER
 * is set to "better-auth". It configures the client with the correct
 * base URL and app scheme for deep linking.
 */

import {createBetterAuthClient} from "@terreno/rtk";
import Constants from "expo-constants";

/**
 * Get the API base URL from environment or default to localhost.
 */
const getBaseURL = (): string => {
  const expoExtra = Constants.expoConfig?.extra;
  return expoExtra?.apiBaseUrl ?? "http://localhost:4000";
};

/**
 * Get the app URL scheme for deep linking.
 */
const getAppScheme = (): string => {
  const expoExtra = Constants.expoConfig?.extra;
  return expoExtra?.scheme ?? "terreno";
};

/**
 * Check if Better Auth is enabled based on environment configuration.
 */
export const isBetterAuthEnabled = (): boolean => {
  const expoExtra = Constants.expoConfig?.extra;
  return expoExtra?.authProvider === "better-auth";
};

/**
 * Better Auth client instance.
 *
 * Only create the client when Better Auth is enabled to avoid
 * unnecessary initialization.
 */
export const betterAuthClient = isBetterAuthEnabled()
  ? createBetterAuthClient({
      baseURL: getBaseURL(),
      scheme: getAppScheme(),
      storagePrefix: "terreno-example",
    })
  : null;

/**
 * Sign in with a social OAuth provider.
 *
 * @example
 * ```typescript
 * await signInWithSocial("google");
 * ```
 */
export const signInWithSocial = async (provider: "google" | "github" | "apple"): Promise<void> => {
  if (!betterAuthClient) {
    throw new Error("Better Auth is not enabled");
  }

  await betterAuthClient.signIn.social({
    provider,
  });
};

/**
 * Sign in with email and password.
 *
 * @example
 * ```typescript
 * await signInWithEmail("user@example.com", "password");
 * ```
 */
export const signInWithEmail = async (email: string, password: string): Promise<void> => {
  if (!betterAuthClient) {
    throw new Error("Better Auth is not enabled");
  }

  await betterAuthClient.signIn.email({
    email,
    password,
  });
};

/**
 * Sign up with email and password.
 *
 * @example
 * ```typescript
 * await signUpWithEmail("user@example.com", "password", "John Doe");
 * ```
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  name: string
): Promise<void> => {
  if (!betterAuthClient) {
    throw new Error("Better Auth is not enabled");
  }

  await betterAuthClient.signUp.email({
    email,
    name,
    password,
  });
};

/**
 * Sign out the current user.
 */
export const signOut = async (): Promise<void> => {
  if (!betterAuthClient) {
    throw new Error("Better Auth is not enabled");
  }

  await betterAuthClient.signOut();
};

/**
 * Get the current session.
 *
 * @returns The current session data, or null if not authenticated.
 */
export const getSession = async () => {
  if (!betterAuthClient) {
    return null;
  }

  return betterAuthClient.getSession();
};
