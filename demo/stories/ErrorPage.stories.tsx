import {Box, ErrorPage} from "@terreno/ui";
import type React from "react";
import {useCallback} from "react";

export const ErrorPageDemo: React.FC = (): React.ReactElement => {
  const resetError = useCallback((): void => {}, []);
  return (
    <Box height={280}>
      <ErrorPage error={new Error("Demo failure")} resetError={resetError} />
    </Box>
  );
};

export const ErrorPageNetwork: React.FC = (): React.ReactElement => {
  const resetError = useCallback((): void => {}, []);
  return (
    <Box height={280}>
      <ErrorPage error={new Error("Network request failed")} resetError={resetError} />
    </Box>
  );
};
