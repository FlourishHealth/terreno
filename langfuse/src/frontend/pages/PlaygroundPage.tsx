import {Box, Heading, SelectField, Spinner, Text} from "@terreno/ui";
import React, {useState} from "react";
import {PromptPlayground} from "../components/PromptPlayground";
import {usePrompts} from "../hooks/usePrompts";

export const PlaygroundPage: React.FC = () => {
  const {prompts, isLoading, error} = usePrompts(100);
  const [selectedName, setSelectedName] = useState<string>("");

  if (isLoading) {
    return (
      <Box alignItems="center" justifyContent="center" padding={8}>
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={4}>
        <Text color="error">{error}</Text>
      </Box>
    );
  }

  const promptOptions = [
    {label: "Select a prompt…", value: ""},
    ...prompts.map((p) => ({label: `${p.name} (v${p.version})`, value: p.name})),
  ];

  return (
    <Box gap={4} padding={4}>
      <Heading size="lg">Playground</Heading>

      <SelectField
        onChange={setSelectedName}
        options={promptOptions}
        title="Prompt"
        value={selectedName}
      />

      {selectedName && <PromptPlayground promptName={selectedName} />}

      {!selectedName && <Text color="secondaryDark">Select a prompt above to start testing.</Text>}
    </Box>
  );
};
