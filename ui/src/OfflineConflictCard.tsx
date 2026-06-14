import type React from "react";
import {useCallback} from "react";

import {Box} from "./Box";
import {Button} from "./Button";
import {Card} from "./Card";
import {Heading} from "./Heading";
import type {OfflineConflictItem} from "./OfflineConflictList";
import {Text} from "./Text";

export interface OfflineConflictCardProps {
  conflict: OfflineConflictItem;
  onKeepMine: (conflictId: string) => void;
  onUseServer: (conflictId: string) => void;
  renderLocalValue?: (conflict: OfflineConflictItem) => React.ReactNode;
  renderServerValue?: (conflict: OfflineConflictItem) => React.ReactNode;
  testID?: string;
}

const defaultRenderValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined) {
    return <Text color="secondaryLight">—</Text>;
  }
  if (typeof value === "object") {
    return (
      <Text color="secondaryDark" size="sm">
        {JSON.stringify(value, null, 2)}
      </Text>
    );
  }
  return (
    <Text color="secondaryDark" size="sm">
      {String(value)}
    </Text>
  );
};

export const OfflineConflictCard: React.FC<OfflineConflictCardProps> = ({
  conflict,
  onKeepMine,
  onUseServer,
  renderLocalValue,
  renderServerValue,
  testID = "offline-conflict-card",
}) => {
  const handleKeepMine = useCallback((): void => {
    onKeepMine(conflict.id);
  }, [conflict.id, onKeepMine]);

  const handleUseServer = useCallback((): void => {
    onUseServer(conflict.id);
  }, [conflict.id, onUseServer]);

  const localContent = renderLocalValue
    ? renderLocalValue(conflict)
    : defaultRenderValue(conflict.localBody ?? conflict.localArgs);
  const serverContent = renderServerValue
    ? renderServerValue(conflict)
    : defaultRenderValue(conflict.serverValue);

  return (
    <Card color="error" testID={testID}>
      <Box gap={3} testID="conflict-notification">
        <Heading size="sm">Sync conflict</Heading>
        <Text color="secondaryDark" size="sm">
          {conflict.modelName} was changed on the server while you had local changes queued.
        </Text>

        <Box gap={1}>
          <Text bold size="sm">
            Your version
          </Text>
          {localContent}
        </Box>

        <Box gap={1}>
          <Text bold size="sm">
            Server version
          </Text>
          {serverContent}
        </Box>

        <Box direction="row" gap={2}>
          <Button
            onClick={handleKeepMine}
            testID={`conflict-keep-mine-${conflict.id}`}
            text="Keep mine"
            variant="outline"
          />
          <Button
            onClick={handleUseServer}
            testID={`conflict-use-server-${conflict.id}`}
            text="Use server"
            variant="muted"
          />
        </Box>
      </Box>
    </Card>
  );
};
