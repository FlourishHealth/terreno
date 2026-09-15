import {Box, Text, WebAddressAutocomplete} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";

export const WebAddressAutocompleteDemo: React.FC = (): React.ReactElement => {
  const [value, setValue] = useState("");
  const handleAddressChange = useCallback((next: string): void => {
    setValue(next);
  }, []);
  const handleAutoCompleteChange = useCallback((): void => {}, []);
  return (
    <Box gap={2}>
      <WebAddressAutocomplete
        handleAddressChange={handleAddressChange}
        handleAutoCompleteChange={handleAutoCompleteChange}
        inputValue={value}
      />
      <Text>Without a Google key this falls back to a text field.</Text>
    </Box>
  );
};

export const WebAddressAutocompleteDisabled: React.FC = (): React.ReactElement => {
  const handleAddressChange = useCallback((): void => {}, []);
  const handleAutoCompleteChange = useCallback((): void => {}, []);
  return (
    <WebAddressAutocomplete
      disabled
      handleAddressChange={handleAddressChange}
      handleAutoCompleteChange={handleAutoCompleteChange}
      inputValue="1 Main St"
    />
  );
};
