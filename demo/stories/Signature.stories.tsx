import {Box, Signature, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";

export const SignatureDemo: React.FC = (): React.ReactElement => {
  const [value, setValue] = useState("");
  const onChange = useCallback((signature: string): void => {
    setValue(signature);
  }, []);
  return (
    <Box gap={3}>
      <Signature onChange={onChange} />
      <Text>{value ? "Stroke captured." : "Draw on the pad."}</Text>
    </Box>
  );
};

export const SignatureFullWidth: React.FC = (): React.ReactElement => {
  const onChange = useCallback((): void => {}, []);
  return (
    <Box width="100%">
      <Signature fullWidth onChange={onChange} />
    </Box>
  );
};
