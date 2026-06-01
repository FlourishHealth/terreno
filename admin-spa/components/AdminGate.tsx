import {useAdminConfig} from "@terreno/admin-frontend";
import {selectBetterAuthIsAuthenticated, selectBetterAuthIsLoading} from "@terreno/rtk";
import {Box, Spinner} from "@terreno/ui";
import {usePathname, useRouter} from "expo-router";
import React, {useEffect} from "react";
import {useDispatch, useSelector} from "react-redux";
import {terrenoApi} from "../store/sdk";
import {useAppConfig} from "./AppConfigGate";
import {useAuth} from "./StoreProvider";

interface RtkError {
  status?: number;
}

const LoadingScreen: React.FC = () => (
  <Box
    alignItems="center"
    justifyContent="center"
    padding={6}
    testID="admin-spa-admin-gate-loading"
  >
    <Spinner />
  </Box>
);

/**
 * Auth + authorization gate. Syncs the better-auth session on mount, then:
 * - unauthenticated → redirect to /login
 * - authenticated but NOT an admin (admin API returns 403) → redirect to /forbidden
 * - authenticated admin sitting on /login or /forbidden → redirect to /
 *
 * Admin status is determined by the backend's own authorization on `${adminApiBase}/config`
 * (200 = admin, 403 = forbidden), since the better-auth session does not carry the
 * Terreno `admin` flag.
 */
export const AdminGate: React.FC<{children: React.ReactNode}> = ({children}) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const {appConfig} = useAppConfig();
  const {syncSession} = useAuth();

  const isAuthLoading = useSelector(selectBetterAuthIsLoading);
  const isAuthenticated = useSelector(selectBetterAuthIsAuthenticated);

  const apiBase = appConfig.adminApiBasePath ?? "/admin";
  const {config, isLoading: isConfigLoading, error} = useAdminConfig(terrenoApi, apiBase);
  const status = (error as RtkError | undefined)?.status;
  const isForbidden = isAuthenticated && !isConfigLoading && Boolean(error) && status !== 401;
  const isAdmin = isAuthenticated && !isConfigLoading && !error && Boolean(config);

  // Sync the better-auth session into Redux once on mount.
  useEffect(() => {
    void syncSession(dispatch);
  }, [dispatch, syncSession]);

  // Drive redirects from auth + authorization state.
  useEffect(() => {
    if (isAuthLoading) {
      return;
    }
    if (!isAuthenticated || status === 401) {
      if (pathname !== "/login") {
        router.replace("/login");
      }
      return;
    }
    if (isForbidden) {
      if (pathname !== "/forbidden") {
        router.replace("/forbidden");
      }
      return;
    }
    if (isAdmin && (pathname === "/login" || pathname === "/forbidden")) {
      router.replace("/");
    }
  }, [isAuthLoading, isAuthenticated, isForbidden, isAdmin, status, pathname, router]);

  if (isAuthLoading) {
    return <LoadingScreen />;
  }
  if (!isAuthenticated || status === 401) {
    return pathname === "/login" ? children : <LoadingScreen />;
  }
  if (isForbidden) {
    return pathname === "/forbidden" ? children : <LoadingScreen />;
  }
  if (isConfigLoading) {
    return <LoadingScreen />;
  }
  return children;
};
