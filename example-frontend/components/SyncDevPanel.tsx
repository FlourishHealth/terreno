import {
  type ConflictResolutionStrategy,
  DEFAULT_KEY_CACHE_DB_NAME,
  OUTBOX_TABLE,
  wipeLocalData,
} from "@terreno/syncdb";
import {useConflicts, useSyncDbClient, useSyncStatus} from "@terreno/syncdb/react";
import {Box, Button, Heading, SegmentedControl, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useEffect, useState} from "react";
import {SyncLabRateControls} from "@/components/SyncLabRateControls";
import {useSyncLabRates} from "@/components/syncLabRates";
import {useOpenSyncDebugger} from "@/hooks/useOpenSyncDebugger";
import {useOpenSyncLab} from "@/hooks/useOpenSyncLab";
import {SYNC_DB_NAME} from "@/store/syncdb";

/** Human-readable explanation for each reason a force resync declined to run. */
const RESYNC_SKIP_MESSAGES: Record<string, string> = {
  authPaused: "sync is auth-paused (sign in again)",
  noHttpChannel: "no HTTP channel configured (missing baseUrl)",
  noStreams: "no sync streams found for this user",
  offline: "client is offline",
  superseded: "a restart or user switch took over mid-resync (try again)",
};

/** Conflict resolution strategies, aligned with the toggle labels below. */
const RESOLVE_STRATEGIES: ConflictResolutionStrategy[] = ["useServer", "keepMine"];
const RESOLVE_LABELS = ["Use the other version", "Keep my change"];

/** Playwright chaos e2e dispatches this on window to restart the client after flaps.
 * Must stay mounted even when the visible Sync Lab panel is hidden (__DEV__ false). */
const E2E_FORCE_RECONNECT_EVENT = "syncdb-e2e-reconnect";

/**
 * Dev panel for exercising syncdb offline/reconnect/wipe flows and Sync Lab churn.
 *
 * Visibility is gated by the admin Sync Lab toggle ({@link useSyncLabRates}
 * `showDevPanel`) so the panel can be shown or hidden without a rebuild.
 *
 * The offline toggle uses the client's transport-level offline simulation
 * (goOffline/goOnline): the socket disconnects and replay/reconcile pause, but
 * the client stays started, so mutations keep applying locally and queueing in
 * the durable outbox. Going back online reconnects and replays the queue.
 * Force reconnect performs a full stop()/start() restart instead.
 */
export const SyncDevPanel: React.FC = () => {
  const client = useSyncDbClient();
  const handleOpenDebugger = useOpenSyncDebugger();
  const handleOpenSyncLab = useOpenSyncLab();
  const {showDevPanel} = useSyncLabRates();
  const {conflicts, resolve} = useConflicts();
  const status = useSyncStatus();
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [resolveStrategyIndex, setResolveStrategyIndex] = useState<number>(0);
  const [resyncMessage, setResyncMessage] = useState<string>("");

  const failedCount = status.failedCount ?? 0;

  const handleResolveAll = useCallback((): void => {
    const strategy = RESOLVE_STRATEGIES[resolveStrategyIndex];
    // Snapshot first: resolving mutates the conflicts table that `conflicts`
    // is derived from, so iterate a stable copy.
    for (const conflict of [...conflicts]) {
      resolve({mutationId: conflict.mutationId, strategy});
    }
  }, [conflicts, resolve, resolveStrategyIndex]);

  // Re-enable the queued successors of every terminally-failed mutation (B4).
  // The failed rows themselves are terminal and stay put, but their entities
  // stop blocking the outbox so the rest of the queue can drain.
  const handleRetryFailed = useCallback((): void => {
    const rows = client.store.raw.getTable(OUTBOX_TABLE);
    const failedEntityIds = new Set<string>();
    for (const row of Object.values(rows)) {
      const {status: rowStatus, entityId} = row as {status?: string; entityId?: string};
      if (rowStatus === "failed" && entityId) {
        failedEntityIds.add(entityId);
      }
    }
    for (const entityId of failedEntityIds) {
      client.retryFailed({entityId});
    }
  }, [client]);

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

  // Report the outcome inline: a resync that cannot run (offline, auth-paused, no
  // streams) is otherwise indistinguishable from one that ran and changed nothing.
  const handleForceResync = useCallback(async (): Promise<void> => {
    setIsBusy(true);
    setResyncMessage("Resyncing…");
    try {
      const result = await client.forceResync();
      if (!result.ok) {
        setResyncMessage(
          `Resync did not run: ${RESYNC_SKIP_MESSAGES[result.reason ?? "noStreams"]}`
        );
        return;
      }
      setResyncMessage(
        `Resynced ${result.streams} stream(s): purged ${result.purged}, repaired ${result.repaired}`
      );
    } catch (error) {
      console.error("[syncdb] Dev panel force resync failed", error);
      setResyncMessage(`Resync failed: ${String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }, [client]);

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

  const handleToggleExpanded = useCallback((): void => {
    setIsExpanded((current) => !current);
  }, []);

  // Listen even when the visible panel is collapsed or omitted so CircleCI's
  // production static export can still break socket backoff after chaos flaps.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onReconnect = (): void => {
      void handleForceReconnect();
    };
    window.addEventListener(E2E_FORCE_RECONNECT_EVENT, onReconnect);
    return () => {
      window.removeEventListener(E2E_FORCE_RECONNECT_EVENT, onReconnect);
    };
  }, [handleForceReconnect]);

  if (!showDevPanel) {
    return null;
  }

  return (
    <Box border="dark" gap={3} marginBottom={4} padding={3} rounding="md" testID="syncdb-dev-panel">
      <Box alignItems="center" direction="row" justifyContent="between">
        <Heading size="sm">SyncDB dev panel</Heading>
        <Button
          onClick={handleToggleExpanded}
          testID="syncdb-dev-panel-toggle"
          text={isExpanded ? "Hide" : "Show"}
          variant="ghost"
        />
      </Box>
      {!isExpanded ? null : (
        <>
          <Text color="secondaryLight" size="sm">
            {isOffline ? "Simulated offline (transport severed)" : "Client running"}
          </Text>
          {resyncMessage ? (
            <Text color="primary" size="sm" testID="syncdb-resync-status">
              {resyncMessage}
            </Text>
          ) : null}

          <Box gap={2}>
            <Heading size="sm">Continuous churn</Heading>
            <Text color="secondaryLight" size="sm">
              Same rates as the admin Sync Lab. Engines keep running while you navigate.
            </Text>
            <SyncLabRateControls />
          </Box>

          <Box direction="row" gap={2} wrap>
            <Button
              iconName="bug"
              onClick={handleOpenDebugger}
              testID="syncdb-open-debugger"
              text="Open debugger"
              variant="primary"
            />
            <Button
              iconName="flask"
              onClick={handleOpenSyncLab}
              testID="syncdb-open-sync-lab"
              text="Open Sync Lab"
              variant="secondary"
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
              onClick={handleForceResync}
              testID="syncdb-force-resync-button"
              text="Force full resync"
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

          <Box border="default" gap={3} padding={3} rounding="md">
            <Heading size="sm">Stuck outbox</Heading>
            <Text
              color={
                conflicts.length > 0 || failedCount > 0 || status.queuedCount > 0
                  ? "primary"
                  : "secondaryLight"
              }
              size="sm"
              testID="syncdb-outbox-status"
            >
              {`queued ${status.queuedCount} · conflicts ${conflicts.length} · failed ${failedCount}`}
            </Text>
            <SegmentedControl
              items={RESOLVE_LABELS}
              onChange={setResolveStrategyIndex}
              selectedIndex={resolveStrategyIndex}
            />
            <Box direction="row" gap={2} wrap>
              <Button
                disabled={conflicts.length === 0}
                iconName="wrench"
                onClick={handleResolveAll}
                testID="syncdb-resolve-all-button"
                text={`Resolve conflicts (${conflicts.length})`}
                variant="secondary"
              />
              <Button
                disabled={failedCount === 0}
                iconName="rotate-right"
                onClick={handleRetryFailed}
                testID="syncdb-retry-failed-button"
                text={`Retry failed (${failedCount})`}
                variant="outline"
              />
            </Box>
            <Text color="secondaryLight" size="sm">
              Resolve conflicts with the chosen strategy: "Use the other version" discards your edit
              on this device, "Keep my change" re-sends it. Retry failed re-enables writes blocked
              behind a terminal failure.
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
};
