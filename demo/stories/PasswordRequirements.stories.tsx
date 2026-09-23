import {Box, PasswordRequirements, Text} from "@terreno/ui";
import type React from "react";

const REQUIREMENTS = [
  {key: "length", label: "At least 8 characters", validate: (value: string) => value.length >= 8},
  {key: "number", label: "Contains a number", validate: (value: string) => /\d/.test(value)},
];

export const PasswordRequirementsDemo: React.FC = (): React.ReactElement => {
  return (
    <Box gap={2}>
      <Text>Password: secret1</Text>
      <PasswordRequirements password="secret1" requirements={REQUIREMENTS} />
    </Box>
  );
};

export const PasswordRequirementsUnmet: React.FC = (): React.ReactElement => {
  return <PasswordRequirements password="ab" requirements={REQUIREMENTS} />;
};
