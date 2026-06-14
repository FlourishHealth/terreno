import type React from "react";
import {useCallback} from "react";

import {Box} from "./Box";
import {OfflineConflictCard} from "./OfflineConflictCard";

export type OfflineConflictResolution = "keepMine" | "useServer";

export interface OfflineConflictItem {
  id: string;
  modelName: string;
  dismissed: boolean;
  localArgs?: unknown;
  localBody?: Record<string, unknown>;
  serverValue?: unknown;
}

export interface OfflineConflictListProps {
  conflicts: OfflineConflictItem[];
  onResolve: (params: {conflictId: string; resolution: OfflineConflictResolution}) => void;
  renderLocalValue?: (conflict: OfflineConflictItem) => React.ReactNode;
  renderServerValue?: (conflict: OfflineConflictItem) => React.ReactNode;
  testID?: string;
}

export const OfflineConflictList: React.FC<OfflineConflictListProps> = ({
  conflicts,
  onResolve,
  renderLocalValue,
  renderServerValue,
  testID = "offline-conflict-list",
}) => {
  const unresolved = conflicts.filter((conflict) => !conflict.dismissed);

  const handleKeepMine = useCallback(
    (conflictId: string): void => {
      onResolve({conflictId, resolution: "keepMine"});
    },
    [onResolve]
  );

  const handleUseServer = useCallback(
    (conflictId: string): void => {
      onResolve({conflictId, resolution: "useServer"});
    },
    [onResolve]
  );

  if (unresolved.length === 0) {
    return null;
  }

  return (
    <Box gap={3} marginBottom={4} testID={testID}>
      {unresolved.map((conflict) => (
        <OfflineConflictCard
          conflict={conflict}
          key={conflict.id}
          onKeepMine={handleKeepMine}
          onUseServer={handleUseServer}
          renderLocalValue={renderLocalValue}
          renderServerValue={renderServerValue}
          testID={`offline-conflict-card-${conflict.id}`}
        />
      ))}
    </Box>
  );
};
