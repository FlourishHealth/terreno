/**
 * Better Auth client factory for React Native/Expo applications.
 *
 * Provides a configured Better Auth client with Expo-specific storage
 * and deep linking support.
 */

import {expoClient} from "@better-auth/expo/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {createAuthClient} from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import type {BetterAuthClientConfig} from "./betterAuthTypes";
import {IsWeb} from "./platform";

// Re-export types for convenience
export type {
  BetterAuthClientConfig,
  BetterAuthOAuthProvider,
  BetterAuthSession,
  BetterAuthSessionData,
  BetterAuthUser,
} from "./betterAuthTypes";

/**
 * Storage adapter interface matching what Better Auth expects.
 */
interface StorageAdapter {
  setItem: (key: string, value: string) => void | Promise<void>;
  getItem: (key: string) => string | null | Promise<string | null>;
  removeItem?: (key: string) => void | Promise<void>;
}

/**
 * Async storage adapter for Better Auth that works on both web and native.
 * Uses SecureStore on native platforms and AsyncStorage on web.
 */
const createStorageAdapter = (): StorageAdapter => {
  if (IsWeb) {
    return {
      getItem: (key: string): Promise<string | null> => {
        if (typeof window !== "undefined") {
          return AsyncStorage.getItem(key);
        }
        return Promise.resolve(null);
      },
      removeItem: (key: string): Promise<void> => {
        if (typeof window !== "undefined") {
          return AsyncStorage.removeItem(key);
        }
        return Promise.resolve();
      },
      setItem: (key: string, value: string): Promise<void> => {
        if (typeof window !== "undefined") {
          return AsyncStorage.setItem(key, value);
        }
        return Promise.resolve();
      },
    };
  }

  // Native platform - use SecureStore
  return {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  };
};

/**
 * Creates a Better Auth client configured for Expo/React Native.
 *
 * @example
 * ```typescript
 * const authClient = createBetterAuthClient({
 *   baseURL: "http://localhost:3000",
 *   scheme: "terreno",
 * });
 *
 * // Use for social login
 * await authClient.signIn.social({
 *   provider: "google",
 * });
 *
 * // Get current session
 * const session = await authClient.getSession();
 * ```
 */
export const createBetterAuthClient = (config: BetterAuthClientConfig) => {
  const storage = createStorageAdapter();

  return createAuthClient({
    baseURL: config.baseURL,
    plugins: [
      expoClient({
        scheme: config.scheme,
        // biome-ignore lint/suspicious/noExplicitAny: Better Auth storage type is flexible
        storage: storage as any,
        storagePrefix: config.storagePrefix ?? "terreno",
      }),
    ],
  });
};

/**
 * Type of the Better Auth client returned by createBetterAuthClient.
 */
export type BetterAuthClient = ReturnType<typeof createBetterAuthClient>;
