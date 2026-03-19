import React from "react";

import {Box} from "./Box";
import {Button} from "./Button";
import {Heading} from "./Heading";
import {Icon} from "./Icon";
import {Text} from "./Text";

interface UpgradeRequiredScreenProps {
  message: string;
  onUpdate: () => void;
}

export const UpgradeRequiredScreen: React.FC<UpgradeRequiredScreenProps> = ({
  message,
  onUpdate,
}) => {
  return (
    <Box
      alignItems="center"
      color="base"
      direction="column"
      display="flex"
      flex="grow"
      height="100%"
      justifyContent="center"
      padding={6}
      width="100%"
    >
      <Box alignItems="center" direction="column" display="flex" gap={4} maxWidth={400}>
        <Icon color="warning" iconName="triangle-exclamation" size="2xl" />
        <Heading align="center" size="lg">
          Update Required
        </Heading>
        <Text align="center" color="secondaryDark" size="lg">
          {message}
        </Text>
        <Box marginTop={2} width="100%">
          <Button fullWidth onClick={onUpdate} text="Update" variant="primary" />
        </Box>
      </Box>
    </Box>
  );
};
