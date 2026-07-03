import {Banner, Box, Button, Spinner, Text, TextField} from "@terreno/ui";
import React, {useCallback, useState} from "react";

import type {ChatMessage} from "./paletteTypes";

/**
 * The conversational surface: shows the running exchange with the palette assistant, offers a few
 * starter prompts, and lets the user send free-form requests / feedback ("make it warmer", "swap
 * primary to teal"). Sending is delegated to the parent, which calls Gemini and updates the palette.
 */

/** Starter prompts that showcase both vibe-based and color-anchored requests. */
export const EXAMPLE_PROMPTS: string[] = [
  "I want a warm, earthy palette for a cozy recipe app",
  "Stylish modern SaaS dashboard with indigo as the primary color",
  "Calm, trustworthy healthcare app with teal accents",
  "High-contrast dark-friendly palette with a vivid coral accent",
];

interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({message}) => {
  const isUser = message.role === "user";
  return (
    <Box alignItems={isUser ? "end" : "start"} width="100%">
      <Box color={isUser ? "primary" : "neutralLight"} maxWidth="90%" padding={3} rounding="md">
        <Text color={isUser ? "inverted" : "primary"}>{message.text}</Text>
      </Box>
    </Box>
  );
};

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error?: string;
  disabled?: boolean;
  onSend: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  error,
  disabled,
  onSend,
}) => {
  const [draft, setDraft] = useState<string>("");

  const handleSend = useCallback((): void => {
    const trimmed = draft.trim();
    if (!trimmed || isLoading) {
      return;
    }
    onSend(trimmed);
    setDraft("");
  }, [draft, isLoading, onSend]);

  const handleExample = useCallback(
    (prompt: string): void => {
      if (isLoading) {
        return;
      }
      onSend(prompt);
    },
    [isLoading, onSend]
  );

  return (
    <Box flex="grow" gap={3}>
      <Box flex="grow" gap={3} scroll>
        {messages.length === 0 && (
          <Box gap={3}>
            <Text color="secondaryLight">
              Describe the palette you want, or tweak the colors on the right. Try one of these:
            </Text>
            <Box gap={2}>
              {EXAMPLE_PROMPTS.map((prompt) => (
                <Button
                  disabled={disabled || isLoading}
                  key={prompt}
                  onClick={() => handleExample(prompt)}
                  text={prompt}
                  variant="outline"
                />
              ))}
            </Box>
          </Box>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && (
          <Box alignItems="center" direction="row" gap={2}>
            <Spinner size="sm" />
            <Text color="secondaryLight">Generating palette…</Text>
          </Box>
        )}
      </Box>
      {Boolean(error) && <Banner id="palette-chat-error" status="alert" text={error!} />}
      <Box direction="row" gap={2}>
        <Box flex="grow">
          <TextField
            disabled={disabled}
            onChange={setDraft}
            placeholder="e.g. make the primary a deeper teal"
            value={draft}
          />
        </Box>
        <Button
          disabled={disabled || isLoading || !draft.trim()}
          onClick={handleSend}
          text="Send"
          variant="primary"
        />
      </Box>
    </Box>
  );
};
