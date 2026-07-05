import {wipeLocalData} from "@terreno/syncdb";
import {useSyncDbClient} from "@terreno/syncdb/react";
import {Box, Button, Heading, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";
import {SYNC_DB_NAME} from "@/store/syncdb";

/**
 * Dev-only panel for exercising syncdb offline/reconnect/wipe flows.
 *
 * The client does not expose a transport-level "sever" hook, so the offline toggle
 * simulates an outage by stopping the client (disconnects the socket and pauses
 * replay/reconcile) and restores it with start(). Local data and the outbox are
 * durable across the stop, so queued offline mutations replay on restore.
 */
export const SyncDevPanel: React.FC = () => {
  const client = useSyncDbClient();
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const handleToggleOffline = useCallback(async (): Promise<void> => {
    setIsBusy(true);
    try {
      if (isOffline) {
        await client.start();
        setIsOffline(false);
      } else {
        await client.stop();
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
      await wipeLocalData({databaseNames: [SYNC_DB_NAME], store: client.store});
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
        {isOffline ? "Simulated offline (client stopped)" : "Client running"}
      </Text>
      <Box direction="row" gap={2} wrap>
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
