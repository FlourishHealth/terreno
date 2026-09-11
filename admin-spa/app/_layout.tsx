import {AdminProvider, useAdminConfig} from "@terreno/admin-frontend";
import {createSyncDb, type SyncDb} from "@terreno/syncdb";
import {SyncDbProvider, useConflicts} from "@terreno/syncdb/react";
import {Box, Spinner, TerrenoProvider, Text} from "@terreno/ui";
import {Stack} from "expo-router";
import React, {useEffect, useMemo, useState} from "react";
import {AdminGate} from "../components/AdminGate";
import {AppConfigGate, useAppConfig} from "../components/AppConfigGate";
import {StoreProvider, useAuth} from "../components/StoreProvider";
import {createAdminSpaSyncDbConfig, resolveAdminSyncCollections} from "../store/adminSyncDb";
import {terrenoApi} from "../store/sdk";

const SPA_ADMIN_AUTH_HEADERS = (): HeadersInit => ({});

const SyncEnabledAdminProvider: React.FC<{
  apiBase: string;
  children: React.ReactNode;
  client: SyncDb;
}> = ({apiBase, children, client}) => {
  const syncConflicts = useConflicts();
  const [isReady, setIsReady] = useState(false);
  const [startError, setStartError] = useState<string | undefined>();

  // Start the cookie-authenticated window client only while the authorized SPA is mounted.
  useEffect(() => {
    let isStopped = false;
    client
      .start()
      .then(() => {
        if (!isStopped) {
          setIsReady(true);
          setStartError(undefined);
        }
      })
      .catch((error: unknown) => {
        if (!isStopped) {
          setStartError(error instanceof Error ? error.message : String(error));
        }
      });
    return (): void => {
      isStopped = true;
      void client.stop();
    };
  }, [client]);

  if (!isReady) {
    return (
      <Box alignItems="center" justifyContent="center" padding={6}>
        {startError ? (
          <Text testID="admin-spa-sync-error">Admin sync could not start: {startError}</Text>
        ) : (
          <Spinner />
        )}
      </Box>
    );
  }

  return (
    <AdminProvider
      api={terrenoApi}
      apiBase={apiBase}
      credentials="same-origin"
      getAuthHeaders={SPA_ADMIN_AUTH_HEADERS}
      routeBase=""
      syncConflicts={syncConflicts}
      syncDb={client}
    >
      {children}
    </AdminProvider>
  );
};

const AdminProviderBridge: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {appConfig} = useAppConfig();
  const {authClient} = useAuth();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";
  const {config} = useAdminConfig(terrenoApi, apiBase);
  const syncCollections = useMemo(
    (): string[] => resolveAdminSyncCollections(config?.models ?? []),
    [config?.models]
  );
  const syncCollectionsKey = syncCollections.join("|");
  const client = useMemo((): SyncDb | undefined => {
    const collections = syncCollectionsKey.split("|").filter(Boolean);
    if (collections.length === 0) {
      return undefined;
    }
    return createSyncDb(
      createAdminSpaSyncDbConfig({
        authClient,
        collections,
        origin: typeof window === "undefined" ? "http://localhost:4000" : window.location.origin,
      })
    );
  }, [authClient, syncCollectionsKey]);

  if (client) {
    return (
      <SyncDbProvider client={client}>
        <SyncEnabledAdminProvider apiBase={apiBase} client={client}>
          {children}
        </SyncEnabledAdminProvider>
      </SyncDbProvider>
    );
  }

  return (
    <AdminProvider
      api={terrenoApi}
      apiBase={apiBase}
      credentials="same-origin"
      getAuthHeaders={SPA_ADMIN_AUTH_HEADERS}
      routeBase=""
    >
      {children}
    </AdminProvider>
  );
};

/**
 * Provider order:
 * - AppConfigGate (outermost): loads app-config.json before anything else, since the
 *   store + auth client are built from it.
 * - StoreProvider: builds the better-auth client + Redux store, mounts <Provider>.
 * - TerrenoProvider: theme/toast context (inside Provider so theme hooks work).
 * - AdminGate (innermost): session + admin authorization, gating the route Stack.
 */
const RootLayout: React.FC = () => {
  return (
    <AppConfigGate>
      <StoreProvider>
        <TerrenoProvider>
          <AdminGate>
            <AdminProviderBridge>
              <Stack screenOptions={{headerShown: false}} />
            </AdminProviderBridge>
          </AdminGate>
        </TerrenoProvider>
      </StoreProvider>
    </AppConfigGate>
  );
};

export default RootLayout;
