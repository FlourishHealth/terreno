import {Box, Button, Heading, Text, TextField} from "@terreno/ui";
import React, {useState} from "react";
import type {ChatMessage, LangfuseCachedPrompt} from "../../backend/types";
import {useLangfuseContext} from "../LangfuseProvider";

interface PromptEditorProps {
  prompt: LangfuseCachedPrompt;
  onSaved?: (prompt: LangfuseCachedPrompt) => void;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({prompt, onSaved}) => {
  const {apiBaseUrl} = useLangfuseContext();
  const [promptText, setPromptText] = useState(
    prompt.type === "text" ? (prompt.prompt as string) : JSON.stringify(prompt.prompt, null, 2)
  );
  const [labels, setLabels] = useState(prompt.labels.join(", "));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setError(null);

    try {
      let parsedPrompt: string | ChatMessage[] = promptText;
      if (prompt.type === "chat") {
        try {
          parsedPrompt = JSON.parse(promptText) as ChatMessage[];
        } catch {
          throw new Error("Invalid JSON for chat prompt");
        }
      }

      const res = await fetch(`${apiBaseUrl}/prompts`, {
        body: JSON.stringify({
          config: prompt.config,
          labels: labels
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean),
          name: prompt.name,
          prompt: parsedPrompt,
          tags: prompt.tags,
          type: prompt.type,
        }),
        credentials: "include",
        headers: {"Content-Type": "application/json"},
        method: "POST",
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {title?: string};
        throw new Error(body.title ?? `Failed to save prompt: ${res.status}`);
      }

      const saved = (await res.json()) as LangfuseCachedPrompt;
      onSaved?.(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box gap={3}>
      <Heading size="md">{prompt.name}</Heading>
      <Text color="secondaryDark" size="sm">
        Version {prompt.version} · {prompt.type}
      </Text>

      <TextField
        grow
        multiline
        onChange={setPromptText}
        rows={10}
        title="Prompt"
        value={promptText}
      />

      <TextField
        onChange={setLabels}
        placeholder="production, staging"
        title="Labels (comma-separated)"
        value={labels}
      />

      {error && <Text color="error">{error}</Text>}

      <Button loading={isSaving} onClick={handleSave} text="Save New Version" variant="primary" />
    </Box>
  );
};
