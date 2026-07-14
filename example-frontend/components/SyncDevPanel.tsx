import {DEFAULT_KEY_CACHE_DB_NAME, wipeLocalData} from "@terreno/syncdb";
import {useSyncDbClient} from "@terreno/syncdb/react";
import {Box, Button, Heading, Text} from "@terreno/ui";
import {useRouter} from "expo-router";
import type React from "react";
import {useCallback, useState} from "react";
import {SYNC_DB_NAME} from "@/store/syncdb";

/**
 * Dev-only panel for exercising syncdb offline/reconnect/wipe flows.
 *
 * The offline toggle uses the client's transport-level offline simulation
 * (goOffline/goOnline): the socket disconnects and replay/reconcile pause, but
 * the client stays started, so mutations keep applying locally and queueing in
 * the durable outbox. Going back online reconnects and replays the queue.
 * Force reconnect performs a full stop()/start() restart instead.
 */
export const SyncDevPanel: React.FC = () => {
  const client = useSyncDbClient();
  const router = useRouter();
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const handleOpenDebugger = useCallback((): void => {
    router.push("/syncdb-debug");
  }, [router]);

  const handleToggleOffline = useCallback(async (): Promise<void> => {
    setIsBusy(true);
    try {
      if (isOffline) {
        await client.goOnline();
        setIsOffline(false);
      } else {
        client.goOffline();
        setIsOffline(true);
      }
    } catch (error) {
      console.error("[syncdb] Dev panel offline toggle failed", error);
    } finally {
      setIsBusy(false);
    }
  }, [client, isOffline]);

  const handleForceReconnect = useCallback(async (): Promise<void> => {
    setIsBusy(true);
    try {
      await client.stop();
      await client.start();
      setIsOffline(false);
    } catch (error) {
      console.error("[syncdb] Dev panel reconnect failed", error);
    } finally {
      setIsBusy(false);
    }
  }, [client]);

  const handleWipe = useCallback(async (): Promise<void> => {
    setIsBusy(true);
    try {
      await client.stop();
      // Also drop the cached derived encryption key (web) — a full local
      // wipe should leave nothing behind, including key material cached in
      // its own IndexedDB database.
      await wipeLocalData({
        databaseNames: [SYNC_DB_NAME],
        keyCacheDbNames: [DEFAULT_KEY_CACHE_DB_NAME],
        store: client.store,
      });
      await client.start();
      setIsOffline(false);
    } catch (error) {
      console.error("[syncdb] Dev panel wipe failed", error);
    } finally {
      setIsBusy(false);
    }
  }, [client]);

  if (!__DEV__) {
    return null;
  }

  return (
    <Box border="dark" gap={3} marginBottom={4} padding={3} rounding="md" testID="syncdb-dev-panel">
      <Heading size="sm">SyncDB dev panel</Heading>
      <Text color="secondaryLight" size="sm">
        {isOffline ? "Simulated offline (transport severed)" : "Client running"}
      </Text>
      <Box direction="row" gap={2} wrap>
        <Button
          iconName="bug"
          onClick={handleOpenDebugger}
          testID="syncdb-open-debugger"
          text="Open debugger"
          variant="primary"
        />
        <Button
          disabled={isBusy}
          onClick={handleToggleOffline}
          testID="syncdb-offline-toggle"
          text={isOffline ? "Go online" : "Go offline"}
          variant="outline"
        />
        <Button
          disabled={isBusy || isOffline}
          onClick={handleForceReconnect}
          testID="syncdb-reconnect-button"
          text="Force reconnect"
          variant="outline"
        />
        <Button
          disabled={isBusy}
          onClick={handleWipe}
          testID="syncdb-wipe-button"
          text="Wipe local store"
          variant="destructive"
        />
      </Box>
    </Box>
  );
};
