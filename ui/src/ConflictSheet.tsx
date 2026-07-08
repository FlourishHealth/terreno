import type React from "react";
import {useCallback} from "react";

import {Box} from "./Box";
import {Button} from "./Button";
import {Modal} from "./Modal";
import {Text} from "./Text";

/** Resolution strategy for a sync conflict. */
export type SyncConflictResolutionStrategy = "useServer" | "keepMine";

/**
 * Minimal shape of a sync conflict rendered by {@link ConflictSheet}. Mirrors the fields exposed by
 * @terreno/syncdb's `SyncConflict` (local/server payloads are JSON strings) without importing the
 * data layer, so the sheet stays a pure presentational component.
 */
export interface SyncConflictItem {
  mutationId: string;
  collection: string;
  entityId: string;
  /** Local (optimistic) payload as a JSON string. */
  localData: string;
  /** Server payload as a JSON string. */
  serverData: string;
}

export interface ConflictSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Unresolved conflicts to display. */
  conflicts: SyncConflictItem[];
  /** Called when the user picks a resolution for a conflict. */
  onResolve: (args: {mutationId: string; strategy: SyncConflictResolutionStrategy}) => void;
  testID?: string;
}

const parseConflictData = (json: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to the empty shape; the summary still renders below.
  }
  return {};
};

const describeData = (data: Record<string, unknown>): string => {
  if (typeof data.title === "string") {
    return data.title;
  }
  const json = JSON.stringify(data);
  return json.length > 120 ? `${json.slice(0, 120)}…` : json;
};

const ConflictItem: React.FC<{
  conflict: SyncConflictItem;
  onResolve: (args: {mutationId: string; strategy: SyncConflictResolutionStrategy}) => void;
}> = ({conflict, onResolve}) => {
  const local = parseConflictData(conflict.localData);
  const server = parseConflictData(conflict.serverData);

  const handleKeepMine = useCallback((): void => {
    onResolve({mutationId: conflict.mutationId, strategy: "keepMine"});
  }, [conflict.mutationId, onResolve]);

  const handleUseServer = useCallback((): void => {
    onResolve({mutationId: conflict.mutationId, strategy: "useServer"});
  }, [conflict.mutationId, onResolve]);

  return (
    <Box
      border="default"
      gap={3}
      padding={3}
      rounding="md"
      testID={`conflict-item-${conflict.entityId}`}
    >
      <Text bold size="sm">
        {conflict.collection} · {conflict.entityId}
      </Text>
      <Box direction="row" gap={3}>
        <Box flex="grow" gap={1}>
          <Text bold color="secondaryDark" size="sm">
            Yours
          </Text>
          <Text size="sm">{describeData(local)}</Text>
        </Box>
        <Box flex="grow" gap={1}>
          <Text bold color="secondaryDark" size="sm">
            Server
          </Text>
          <Text size="sm">{describeData(server)}</Text>
        </Box>
      </Box>
      <Box direction="row" gap={2}>
        <Button
          onClick={handleKeepMine}
          testID="conflict-keep-mine-button"
          text="Keep mine"
          variant="outline"
        />
        <Button
          onClick={handleUseServer}
          testID="conflict-use-server-button"
          text="Use server"
          variant="primary"
        />
      </Box>
    </Box>
  );
};

/**
 * Presentational modal listing unresolved sync conflicts with local ("Yours") vs server values side
 * by side and keep-mine / use-server actions. It is data-layer agnostic: pass `conflicts` and an
 * `onResolve` callback (e.g. from @terreno/syncdb's `useConflicts`). Resolving the last conflict
 * dismisses the sheet.
 */
export const ConflictSheet: React.FC<ConflictSheetProps> = ({
  visible,
  onDismiss,
  conflicts,
  onResolve,
  testID = "conflict-sheet",
}) => {
  const handleResolve = useCallback(
    (args: {mutationId: string; strategy: SyncConflictResolutionStrategy}): void => {
      onResolve(args);
      if (conflicts.length <= 1) {
        onDismiss();
      }
    },
    [conflicts.length, onDismiss, onResolve]
  );

  return (
    <Modal onDismiss={onDismiss} title="Sync conflicts" visible={visible}>
      <Box gap={3} testID={testID}>
        {conflicts.length === 0 ? (
          <Text color="secondaryLight">No conflicts to resolve.</Text>
        ) : (
          conflicts.map((conflict) => (
            <ConflictItem conflict={conflict} key={conflict.mutationId} onResolve={handleResolve} />
          ))
        )}
      </Box>
    </Modal>
  );
};
