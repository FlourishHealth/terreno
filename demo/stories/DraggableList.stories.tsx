import {Box, DraggableList, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";

export const DraggableListDemo: React.FC = (): React.ReactElement => {
  const [ids, setIds] = useState(["alpha", "beta", "gamma"]);
  const callbackNewDataIds = useCallback((next: string[]): void => {
    setIds(next);
  }, []);
  const renderItem = useCallback(({item}: {item: string}): React.ReactElement => {
    return (
      <Box padding={3}>
        <Text>{item}</Text>
      </Box>
    );
  }, []);
  return (
    <Box height={200} width="100%">
      <DraggableList
        callbackNewDataIds={callbackNewDataIds}
        dataIDs={ids}
        itemHeight={48}
        renderItem={renderItem}
      />
    </Box>
  );
};

export const DraggableListTwoItems: React.FC = (): React.ReactElement => {
  const callbackNewDataIds = useCallback((): void => {}, []);
  const renderItem = useCallback(({item}: {item: string}): React.ReactElement => {
    return <Text>{item}</Text>;
  }, []);
  return (
    <Box height={140} width="100%">
      <DraggableList
        callbackNewDataIds={callbackNewDataIds}
        dataIDs={["one", "two"]}
        itemHeight={48}
        renderItem={renderItem}
      />
    </Box>
  );
};
