import {useAdminConfig} from "@terreno/admin-frontend";
import {selectBetterAuthIsAuthenticated, selectBetterAuthIsLoading} from "@terreno/rtk";
import {Box, Spinner} from "@terreno/ui";
import {usePathname, useRouter} from "expo-router";
import React, {useEffect} from "react";
import {useDispatch, useSelector} from "react-redux";
import {terrenoApi, useGetAdminSetupStatusQuery} from "../store/sdk";
import {useAppConfig} from "./AppConfigGate";
import {
  ADMIN_GATE_ROUTES,
  isForbiddenAdminConfigError,
  resolveAdminGateState,
} from "./adminGateUtils";
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
 * - no admin user exists yet (backend `firstAdminSetup` opted in) → redirect to /setup
 * - unauthenticated → redirect to /login
 * - authenticated but NOT an admin (admin API returns 403) → redirect to /forbidden
 * - authenticated admin sitting on /login, /forbidden, or /setup → redirect to /
 *
 * Admin status is determined by the backend's own authorization on `${adminApiBase}/config`
 * (200 = admin, 403 = forbidden), since the better-auth session does not carry the
 * Terreno `admin` flag.
 *
 * The setup check calls `${adminApiBase}/setup-status`, which only exists when the backend
 * configured `AdminApp`'s `firstAdminSetup` option. A missing/erroring endpoint (feature not
 * configured, or disabled via `ADMIN_SETUP_DISABLED`) is treated the same as "no setup needed"
 * so the gate falls through to the normal login flow.
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
  const {
    data: setupStatus,
    isLoading: isSetupStatusLoading,
    isError: isSetupStatusError,
  } = useGetAdminSetupStatusQuery({apiBase});
  const needsSetup = !isSetupStatusError && Boolean(setupStatus?.needsSetup);

  const {config, isLoading: isConfigLoading, error} = useAdminConfig(terrenoApi, apiBase);
  const status = (error as RtkError | undefined)?.status;
  const isForbidden = isForbiddenAdminConfigError({
    error,
    isAuthenticated,
    isConfigLoading,
    status,
  });
  const isAdmin = isAuthenticated && !isConfigLoading && !error && Boolean(config);

  const gateState = resolveAdminGateState({
    isAuthenticated,
    isAuthLoading,
    isForbidden,
    isSetupStatusLoading,
    needsSetup,
    status,
  });

  // Sync the better-auth session into Redux once on mount.
  useEffect(() => {
    void syncSession(dispatch);
  }, [dispatch, syncSession]);

  // Drive redirects from setup + auth + authorization state.
  useEffect(() => {
    if (gateState === "loading") {
      return;
    }
    if (gateState === "app") {
      const onGateScreen =
        pathname === "/login" || pathname === "/forbidden" || pathname === "/setup";
      if (isAdmin && onGateScreen) {
        router.replace("/");
      }
      return;
    }
    const target = ADMIN_GATE_ROUTES[gateState];
    if (pathname !== target) {
      router.replace(target);
    }
  }, [gateState, isAdmin, pathname, router]);

  if (gateState === "loading") {
    return <LoadingScreen />;
  }
  if (gateState !== "app") {
    return pathname === ADMIN_GATE_ROUTES[gateState] ? children : <LoadingScreen />;
  }
  if (isConfigLoading) {
    return <LoadingScreen />;
  }
  return children;
};
