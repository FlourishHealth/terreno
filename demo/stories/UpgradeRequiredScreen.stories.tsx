import {Box, UpgradeRequiredScreen} from "@terreno/ui";
import type React from "react";
import {useCallback} from "react";

export const UpgradeRequiredScreenDemo: React.FC = (): React.ReactElement => {
  const onUpdate = useCallback((): void => {}, []);
  return (
    <Box height={360}>
      <UpgradeRequiredScreen
        message="Install the latest version to keep using the app."
        onUpdate={onUpdate}
      />
    </Box>
  );
};

export const UpgradeRequiredScreenCannotUpdate: React.FC = (): React.ReactElement => {
  const onUpdate = useCallback((): void => {}, []);
  return (
    <Box height={360}>
      <UpgradeRequiredScreen
        canUpdate={false}
        message="This build cannot self-update. Install from the store."
        onUpdate={onUpdate}
      />
    </Box>
  );
};
