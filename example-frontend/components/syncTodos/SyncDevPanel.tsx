import {useQuery, useSyncDbClient, useSyncStatus} from "@terreno/syncdb";
import {Badge, Box, Button, Card, Heading, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";

import {createRestSnapshotFetcher, SESSION_COLLECTIONS} from "@/store/syncdb";
import {generateId} from "./ids";

interface TodoData {
  title: string;
  completed: boolean;
  listId?: string;
}

/**
 * Developer/testing controls for the local-first todos screen. Exercises every
 * branch of the sync engine without a real backend: connectivity, replay,
 * persistence, the auth-blocked and conflict UI states, seeding, and a local
 * reset. Rendered only on the syncdb (USE_SYNCDB) path.
 */
export const SyncDevPanel: React.FC = () => {
  const client = useSyncDbClient();
  const status = useSyncStatus();
  const todos = useQuery<TodoData>({collection: "todos"});
  const [open, setOpen] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [prefetchResult, setPrefetchResult] = useState<string | undefined>();

  const toggleConnectivity = useCallback(async (): Promise<void> => {
    if (status.isOnline) {
      client.disconnectSync();
      return;
    }
    setBusy(true);
    try {
      await client.connectSync();
    } finally {
      setBusy(false);
    }
  }, [client, status.isOnline]);

  const forceSync = useCallback((): void => {
    client.replayOutbox();
  }, [client]);

  const forceSave = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      await client.save();
    } finally {
      setBusy(false);
    }
  }, [client]);

  const toggleAuthBlocked = useCallback((): void => {
    const nextBlocked = !status.authBlocked;
    client.setAuthBlocked({authBlocked: nextBlocked});
    // Clearing the block should resume replay, mirroring reconnect behavior.
    if (!nextBlocked) {
      client.replayOutbox();
    }
  }, [client, status.authBlocked]);

  const simulateConflict = useCallback((): void => {
    const target = todos[0];
    if (!target) {
      return;
    }
    client.conflicts.capture<TodoData>({
      collection: "todos",
      entityId: target.id,
      localData: target.data,
      mutationId: generateId(),
      serverData: {...target.data, title: `${target.data.title} (server)`},
      serverVersion: generateId(),
    });
  }, [client, todos]);

  const seedTodos = useCallback((): void => {
    for (let index = 0; index < 5; index += 1) {
      const id = generateId();
      client.store.upsertEntity<TodoData>({
        collection: "todos",
        data: {completed: false, title: `Seeded todo ${index + 1}`},
        id,
      });
      client.outbox.enqueue({
        args: {completed: false, title: `Seeded todo ${index + 1}`},
        collection: "todos",
        entityId: id,
        operation: "create",
      });
    }
    client.replayOutbox();
  }, [client]);

  const resetLocal = useCallback((): void => {
    client.store.clear();
    client.outbox.clear();
    client.conflicts.clear();
  }, [client]);

  const prefetchSession = useCallback(async (): Promise<void> => {
    setBusy(true);
    setPrefetchResult(undefined);
    try {
      const results = await client.hydrate({
        collections: SESSION_COLLECTIONS,
        fetcher: createRestSnapshotFetcher(),
      });
      const total = results.reduce((sum, result) => sum + result.applied, 0);
      setPrefetchResult(`Mirrored ${total} record(s) across ${results.length} collection(s).`);
    } catch (error) {
      setPrefetchResult(
        `Prefetch failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setBusy(false);
    }
  }, [client]);

  return (
    <Card color="neutralLight" marginBottom={6} testID="dev-panel">
      <Box gap={3}>
        <Box alignItems="center" direction="row" justifyContent="between">
          <Heading size="sm">Testing controls</Heading>
          <Button
            onClick={() => setOpen((value) => !value)}
            testID="dev-panel-toggle"
            text={open ? "Hide" : "Show"}
            variant="muted"
          />
        </Box>

        {open ? (
          <Box gap={3}>
            <Box alignItems="center" direction="row" gap={2} wrap>
              <Badge
                status={status.isOnline ? "success" : "error"}
                value={status.isOnline ? "online" : "offline"}
              />
              {status.isSyncing ? <Badge status="info" value="syncing" /> : null}
              {status.authBlocked ? <Badge status="warning" value="auth-blocked" /> : null}
              <Text size="sm" testID="dev-panel-counts">
                queued {status.queuedCount} · failed {status.failedCount} · conflicts{" "}
                {status.conflictCount}
              </Text>
            </Box>

            <Box direction="row" gap={2} wrap>
              <Button
                disabled={busy}
                onClick={toggleConnectivity}
                testID="dev-button-connectivity"
                text={status.isOnline ? "Go offline" : "Go online"}
                variant={status.isOnline ? "outline" : "primary"}
              />
              <Button
                onClick={forceSync}
                testID="dev-button-force-sync"
                text="Force sync"
                variant="secondary"
              />
              <Button
                disabled={busy}
                onClick={forceSave}
                testID="dev-button-force-save"
                text="Force save"
                variant="muted"
              />
              <Button
                onClick={toggleAuthBlocked}
                testID="dev-button-auth-block"
                text={status.authBlocked ? "Clear auth block" : "Simulate auth block"}
                variant="muted"
              />
            </Box>

            <Box direction="row" gap={2} wrap>
              <Button
                disabled={busy}
                iconName="download"
                onClick={prefetchSession}
                testID="dev-button-prefetch"
                text="Prefetch session data"
                variant="primary"
              />
              {prefetchResult ? (
                <Text size="sm" testID="dev-prefetch-result">
                  {prefetchResult}
                </Text>
              ) : null}
            </Box>

            <Box direction="row" gap={2} wrap>
              <Button
                disabled={todos.length === 0}
                onClick={simulateConflict}
                testID="dev-button-simulate-conflict"
                text="Simulate conflict"
                variant="muted"
              />
              <Button
                onClick={seedTodos}
                testID="dev-button-seed"
                text="Seed 5 todos"
                variant="muted"
              />
              <Button
                confirmationText="Clear all local todos, lists, comments, queue, and conflicts?"
                onClick={resetLocal}
                testID="dev-button-reset"
                text="Reset local data"
                variant="destructive"
                withConfirmation
              />
            </Box>
          </Box>
        ) : null}
      </Box>
    </Card>
  );
};
