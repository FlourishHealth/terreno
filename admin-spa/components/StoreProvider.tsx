import {configureStore} from "@reduxjs/toolkit";
import {type BetterAuthClientInterface, generateBetterAuthSlice} from "@terreno/rtk";
import {createAuthClient} from "better-auth/react";
import React, {createContext, useContext, useMemo} from "react";
import {Provider} from "react-redux";
import {openapi} from "../store/sdk";
import {useAppConfig} from "./AppConfigGate";

type AuthClient = ReturnType<typeof createAuthClient>;

interface AuthContextValue {
  authClient: AuthClient;
  /** Sync the better-auth session into the Redux store. */
  syncSession: (dispatch: unknown) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Access the better-auth client + session sync helper. Throws outside {@link StoreProvider}. */
export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within <StoreProvider>");
  }
  return value;
};

/**
 * Builds the Redux store and better-auth client from the loaded app-config, then mounts
 * the Redux `<Provider>`. Lives below {@link AppConfigGate} because the auth client's
 * `basePath` comes from the config. Uses `better-auth/react`'s `createAuthClient`
 * directly (NOT the RN factory, which drags in expo-secure-store) since the SPA is
 * web-only and relies on same-origin session cookies.
 */
export const StoreProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {appConfig} = useAppConfig();

  const {store, authContext} = useMemo(() => {
    const baseURL =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:4000";
    const authClient = createAuthClient({
      basePath: appConfig.authBasePath ?? "/api/auth",
      baseURL,
    });

    const authSlice = generateBetterAuthSlice({
      authClient: authClient as unknown as BetterAuthClientInterface,
    });

    const builtStore = configureStore({
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(openapi.middleware, ...authSlice.middleware),
      reducer: {
        betterAuth: authSlice.reducer,
        [openapi.reducerPath]: openapi.reducer,
      },
    });

    return {
      authContext: {authClient, syncSession: authSlice.syncSession},
      store: builtStore,
    };
  }, [appConfig.authBasePath]);

  return (
    <Provider store={store}>
      <AuthContext.Provider value={authContext}>{children}</AuthContext.Provider>
    </Provider>
  );
};
