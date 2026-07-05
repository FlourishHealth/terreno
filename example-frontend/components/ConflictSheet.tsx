import type {SyncConflict} from "@terreno/syncdb";
import {useConflicts} from "@terreno/syncdb/react";
import {Box, Button, Modal, Text} from "@terreno/ui";
import type React from "react";
import {useCallback} from "react";

interface ConflictSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

const parseConflictData = (json: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to the empty shape; the raw JSON still renders below.
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
  conflict: SyncConflict;
  onResolve: (args: {mutationId: string; strategy: "useServer" | "keepMine"}) => void;
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
 * Modal listing unresolved sync conflicts with local vs server values side by side.
 * Resolving the last conflict dismisses the sheet.
 */
export const ConflictSheet: React.FC<ConflictSheetProps> = ({visible, onDismiss}) => {
  const {conflicts, resolve} = useConflicts();

  const handleResolve = useCallback(
    (args: {mutationId: string; strategy: "useServer" | "keepMine"}): void => {
      resolve(args);
      if (conflicts.length <= 1) {
        onDismiss();
      }
    },
    [conflicts.length, onDismiss, resolve]
  );

  return (
    <Modal onDismiss={onDismiss} title="Sync conflicts" visible={visible}>
      <Box gap={3} testID="conflict-sheet">
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
