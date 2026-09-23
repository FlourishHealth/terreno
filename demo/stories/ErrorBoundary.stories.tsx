import {Box, Button, ErrorBoundary, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";

const Boom: React.FC<{shouldThrow: boolean}> = ({shouldThrow}) => {
  if (shouldThrow) {
    throw new Error("Story child crashed");
  }
  return <Text>Child rendered without error.</Text>;
};

export const ErrorBoundaryDemo: React.FC = (): React.ReactElement => {
  return (
    <Box padding={3}>
      <ErrorBoundary>
        <Text>Healthy child inside the boundary.</Text>
      </ErrorBoundary>
    </Box>
  );
};

export const ErrorBoundaryCaught: React.FC = (): React.ReactElement => {
  const [shouldThrow, setShouldThrow] = useState(false);
  const explode = useCallback((): void => {
    setShouldThrow(true);
  }, []);
  return (
    <Box gap={3} padding={3}>
      <Button onClick={explode} text="Crash the child" />
      <ErrorBoundary>
        <Boom shouldThrow={shouldThrow} />
      </ErrorBoundary>
    </Box>
  );
};
