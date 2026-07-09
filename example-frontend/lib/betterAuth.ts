/**
 * Better Auth client configuration for the example frontend.
 */

import {createBetterAuthClient} from "@terreno/rtk";
import Constants from "expo-constants";

const getBaseURL = (): string => {
  const expoExtra = Constants.expoConfig?.extra;
  return (
    process.env.EXPO_PUBLIC_API_URL ??
    expoExtra?.apiBaseUrl ??
    expoExtra?.BASE_URL ??
    "http://localhost:4000"
  );
};

const getAppScheme = (): string => {
  const expoExtra = Constants.expoConfig?.extra;
  return expoExtra?.scheme ?? "frontend";
};

export const betterAuthClient = createBetterAuthClient({
  baseURL: getBaseURL(),
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

export const getSession = async () => {
  return betterAuthClient.getSession();
};

export const getSessionToken = async (): Promise<string | null> => {
  try {
    const result = await betterAuthClient.getSession();
    const envelope = (result as {data?: {session?: {token?: string}}})?.data ?? result;
    return (envelope as {session?: {token?: string}})?.session?.token ?? null;
  } catch {
    return null;
  }
};
