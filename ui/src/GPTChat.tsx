import React, {useCallback, useState} from "react";

import {Box} from "./Box";
import {Button} from "./Button";
import {Heading} from "./Heading";
import {IconButton} from "./IconButton";
import {MarkdownView} from "./MarkdownView";
import {Spinner} from "./Spinner";
import {Text} from "./Text";
import {TextArea} from "./TextArea";

export interface GPTChatMessage {
  content: string;
  role: "user" | "assistant" | "system";
}

export interface GPTChatHistory {
  id: string;
  prompts: GPTChatMessage[];
  title?: string;
  updated?: string;
}

export interface GPTChatProps {
  currentHistoryId?: string;
  currentMessages: GPTChatMessage[];
  histories: GPTChatHistory[];
  isStreaming?: boolean;
  onCreateHistory: () => void;
  onDeleteHistory: (id: string) => void;
  onMemoryEdit?: (memory: string) => void;
  onSelectHistory: (id: string) => void;
  onSubmit: (prompt: string) => void;
  onUpdateTitle?: (id: string, title: string) => void;
  systemMemory?: string;
  testID?: string;
}

export const GPTChat = ({
  currentHistoryId,
  currentMessages,
  histories,
  isStreaming = false,
  onCreateHistory,
  onDeleteHistory,
  onMemoryEdit,
  onSelectHistory,
  onSubmit,
  systemMemory,
  testID,
}: GPTChatProps): React.ReactElement => {
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) {
      return;
    }
    onSubmit(trimmed);
    setInputValue("");
  }, [inputValue, isStreaming, onSubmit]);

  return (
    <Box direction="row" flex="grow" testID={testID}>
      {/* Sidebar */}
      <Box border="default" color="base" minWidth={250} overflow="scrollY" padding={3} width="30%">
        <Box alignItems="center" direction="row" justifyContent="between" marginBottom={3}>
          <Heading size="sm">Chats</Heading>
          <Box direction="row" gap={1}>
            {onMemoryEdit ? (
              <IconButton
                accessibilityLabel="Edit system memory"
                iconName="gear"
                onClick={() => onMemoryEdit(systemMemory ?? "")}
                testID="gpt-memory-button"
              />
            ) : null}
            <IconButton
              accessibilityLabel="New chat"
              iconName="plus"
              onClick={onCreateHistory}
              testID="gpt-new-chat-button"
            />
          </Box>
        </Box>

        {histories.map((history) => (
          <Box
            accessibilityHint="Opens this chat history"
            accessibilityLabel={`Select chat: ${history.title ?? "New Chat"}`}
            alignItems="center"
            color={history.id === currentHistoryId ? "primary" : undefined}
            direction="row"
            justifyContent="between"
            key={history.id}
            marginBottom={1}
            onClick={() => onSelectHistory(history.id)}
            padding={2}
            rounding="md"
          >
            <Text
              color={history.id === currentHistoryId ? "inverted" : "primary"}
              size="sm"
              truncate
            >
              {history.title ?? "New Chat"}
            </Text>
            <IconButton
              accessibilityLabel={`Delete chat: ${history.title ?? "New Chat"}`}
              iconName="trash"
              onClick={() => onDeleteHistory(history.id)}
              testID={`gpt-delete-history-${history.id}`}
              variant="destructive"
            />
          </Box>
        ))}
      </Box>

      {/* Chat Panel */}
      <Box direction="column" flex="grow" padding={4}>
        {/* Messages */}
        <Box flex="grow" gap={3} marginBottom={3} overflow="scrollY">
          {currentMessages.map((message, index) => (
            <Box alignItems={message.role === "user" ? "end" : "start"} key={`msg-${index}`}>
              <Box
                color={message.role === "user" ? "primary" : "neutralLight"}
                maxWidth="80%"
                padding={3}
                rounding="lg"
              >
                {message.role === "assistant" ? (
                  <MarkdownView>{message.content}</MarkdownView>
                ) : (
                  <Text color={message.role === "user" ? "inverted" : "primary"}>
                    {message.content}
                  </Text>
                )}
              </Box>
            </Box>
          ))}
          {isStreaming ? (
            <Box alignItems="start" padding={2}>
              <Spinner size="sm" />
            </Box>
          ) : null}
        </Box>

        {/* Input */}
        <Box alignItems="end" direction="row" gap={2}>
          <Box flex="grow">
            <TextArea
              disabled={isStreaming}
              onChange={setInputValue}
              placeholder="Type a message..."
              testID="gpt-input"
              value={inputValue}
            />
          </Box>
          <Button
            disabled={!inputValue.trim() || isStreaming}
            iconName="paper-plane"
            onClick={handleSubmit}
            testID="gpt-submit"
            text="Send"
          />
        </Box>
      </Box>
    </Box>
  );
};
