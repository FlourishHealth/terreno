import {Box, Button, Heading, Text, TextField} from "@terreno/ui";
import React, {useState} from "react";
import type {ChatMessage} from "../../backend/types";
import {useLangfuseContext} from "../LangfuseProvider";

interface PlaygroundResult {
  compiled: string | ChatMessage[];
  type: "text" | "chat";
  variables: string[];
  name: string;
  version: number;
}

interface PromptPlaygroundProps {
  promptName: string;
  label?: string;
}

export const PromptPlayground: React.FC<PromptPlaygroundProps> = ({promptName, label}) => {
  const {apiBaseUrl} = useLangfuseContext();
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedVars, setDetectedVars] = useState<string[]>([]);

  const handleCompile = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/playground`, {
        body: JSON.stringify({label, promptName, variables}),
        credentials: "include",
        headers: {"Content-Type": "application/json"},
        method: "POST",
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {title?: string};
        throw new Error(body.title ?? `Playground error: ${res.status}`);
      }

      const data = (await res.json()) as PlaygroundResult;
      setResult(data);
      setDetectedVars(data.variables);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const compiledText =
    result?.type === "text"
      ? (result.compiled as string)
      : JSON.stringify(result?.compiled, null, 2);

  return (
    <Box gap={3}>
      <Heading size="md">Playground: {promptName}</Heading>

      {detectedVars.length > 0 && (
        <Box gap={2}>
          <Text bold>Variables</Text>
          {detectedVars.map((varName) => (
            <TextField
              key={varName}
              onChange={(value) => setVariables((prev) => ({...prev, [varName]: value}))}
              placeholder={`Value for {{${varName}}}`}
              title={varName}
              value={variables[varName] ?? ""}
            />
          ))}
        </Box>
      )}

      <Button loading={isLoading} onClick={handleCompile} text="Compile" variant="secondary" />

      {error && <Text color="error">{error}</Text>}

      {result && (
        <Box gap={2}>
          <Text bold>Compiled Output</Text>
          <Box color="disabled" padding={3} rounding="md">
            <Text>{compiledText}</Text>
          </Box>
          {result.type === "chat" && Array.isArray(result.compiled) && (
            <Box gap={2}>
              {(result.compiled as ChatMessage[]).map((msg, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: chat messages don't have unique IDs
                <Box gap={1} key={i}>
                  <Text bold size="sm">
                    {msg.role}
                  </Text>
                  <Text>{msg.content}</Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};
