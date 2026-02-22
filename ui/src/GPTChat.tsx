import * as Clipboard from "expo-clipboard";
import React, {useCallback, useRef, useState} from "react";
import {Image as RNImage, type ScrollView as RNScrollView} from "react-native";

import {AttachmentPreview} from "./AttachmentPreview";
import {Box} from "./Box";
import {Button} from "./Button";
import type {SelectedFile} from "./FilePickerButton";
import {FilePickerButton} from "./FilePickerButton";
import {Heading} from "./Heading";
import {Icon} from "./Icon";
import {IconButton} from "./IconButton";
import {MarkdownView} from "./MarkdownView";
import {Spinner} from "./Spinner";
import {Text} from "./Text";
import {TextArea} from "./TextArea";

// ============================================================
// Content Part Types (mirroring backend types for rendering)
// ============================================================

export interface TextContentPart {
  type: "text";
  text: string;
}

export interface ImageContentPart {
  type: "image";
  url: string;
  mimeType?: string;
}

export interface FileContentPart {
  type: "file";
  url: string;
  filename?: string;
  mimeType: string;
}

export type MessageContentPart = TextContentPart | ImageContentPart | FileContentPart;

// ============================================================
// Tool Call Types
// ============================================================

export interface ToolCallInfo {
  args: Record<string, unknown>;
  toolCallId: string;
  toolName: string;
}

export interface ToolResultInfo {
  result: unknown;
  toolCallId: string;
  toolName: string;
}

// ============================================================
// Message Types
// ============================================================

export interface GPTChatMessage {
  content: string;
  contentParts?: MessageContentPart[];
  role: "user" | "assistant" | "system" | "tool-call" | "tool-result";
  toolCall?: ToolCallInfo;
  toolResult?: ToolResultInfo;
}

export interface GPTChatHistory {
  id: string;
  prompts: GPTChatMessage[];
  title?: string;
  updated?: string;
}

export interface MCPServerStatus {
  connected: boolean;
  name: string;
}

export interface GPTChatProps {
  attachments?: SelectedFile[];
  currentHistoryId?: string;
  currentMessages: GPTChatMessage[];
  histories: GPTChatHistory[];
  isStreaming?: boolean;
  mcpServers?: MCPServerStatus[];
  onAttachFiles?: (files: SelectedFile[]) => void;
  onCreateHistory: () => void;
  onDeleteHistory: (id: string) => void;
  onMemoryEdit?: (memory: string) => void;
  onRemoveAttachment?: (index: number) => void;
  onSelectHistory: (id: string) => void;
  onSubmit: (prompt: string) => void;
  onUpdateTitle?: (id: string, title: string) => void;
  systemMemory?: string;
  testID?: string;
}

const ToolCallCard = ({toolCall}: {toolCall: ToolCallInfo}): React.ReactElement => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Box border="default" padding={2} rounding="md">
      <Box
        accessibilityHint="Toggle tool call details"
        accessibilityLabel={`Tool: ${toolCall.toolName}`}
        alignItems="center"
        direction="row"
        gap={1}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Icon iconName="wrench" size="xs" />
        <Text bold size="sm">
          Tool: {toolCall.toolName}
        </Text>
        <Icon iconName={isExpanded ? "chevron-up" : "chevron-down"} size="xs" />
      </Box>
      {isExpanded ? (
        <Box marginTop={1} padding={1}>
          <Text color="secondaryDark" size="sm">
            {JSON.stringify(toolCall.args, null, 2)}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
};

const ToolResultCard = ({toolResult}: {toolResult: ToolResultInfo}): React.ReactElement => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Box border="default" padding={2} rounding="md">
      <Box
        accessibilityHint="Toggle tool result details"
        accessibilityLabel={`Result: ${toolResult.toolName}`}
        alignItems="center"
        direction="row"
        gap={1}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Icon iconName="check" size="xs" />
        <Text bold size="sm">
          Result: {toolResult.toolName}
        </Text>
        <Icon iconName={isExpanded ? "chevron-up" : "chevron-down"} size="xs" />
      </Box>
      {isExpanded ? (
        <Box marginTop={1} padding={1}>
          <Text color="secondaryDark" size="sm">
            {typeof toolResult.result === "string"
              ? toolResult.result
              : JSON.stringify(toolResult.result, null, 2)}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
};

const MessageContentParts = ({parts}: {parts: MessageContentPart[]}): React.ReactElement => {
  return (
    <Box gap={2}>
      {parts.map((part, index) => {
        if (part.type === "image") {
          return (
            <RNImage
              key={`content-${index}`}
              resizeMode="contain"
              source={{uri: part.url}}
              style={{borderRadius: 8, height: 200, maxWidth: 300, width: "100%"}}
            />
          );
        }
        if (part.type === "file") {
          return (
            <Box
              alignItems="center"
              border="default"
              direction="row"
              gap={1}
              key={`content-${index}`}
              padding={2}
              rounding="md"
            >
              <Icon iconName="file" size="sm" />
              <Text size="sm">{part.filename ?? "File"}</Text>
            </Box>
          );
        }
        return null;
      })}
    </Box>
  );
};

const MCPStatusIndicator = ({servers}: {servers: MCPServerStatus[]}): React.ReactElement => {
  const [showList, setShowList] = useState(false);
  const connectedCount = servers.filter((s) => s.connected).length;

  return (
    <Box>
      <Box
        accessibilityHint="Show MCP server list"
        accessibilityLabel="MCP server status"
        alignItems="center"
        direction="row"
        gap={1}
        onClick={() => setShowList(!showList)}
      >
        <Box
          color={connectedCount > 0 ? "success" : "error"}
          height={8}
          rounding="circle"
          width={8}
        />
        <Text color="secondaryDark" size="sm">
          {connectedCount}/{servers.length} MCP
        </Text>
      </Box>
      {showList ? (
        <Box border="default" marginTop={1} padding={2} position="absolute" rounding="md">
          {servers.map((server) => (
            <Box alignItems="center" direction="row" gap={1} key={server.name} padding={1}>
              <Box
                color={server.connected ? "success" : "error"}
                height={6}
                rounding="circle"
                width={6}
              />
              <Text size="sm">{server.name}</Text>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

export const GPTChat = ({
  attachments = [],
  currentHistoryId,
  currentMessages,
  histories,
  isStreaming = false,
  mcpServers,
  onAttachFiles,
  onCreateHistory,
  onDeleteHistory,
  onMemoryEdit,
  onRemoveAttachment,
  onSelectHistory,
  onSubmit,
  systemMemory,
  testID,
}: GPTChatProps): React.ReactElement => {
  const [inputValue, setInputValue] = useState("");
  const scrollViewRef = useRef<RNScrollView>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) {
      return;
    }
    onSubmit(trimmed);
    setInputValue("");
  }, [inputValue, isStreaming, onSubmit]);

  const handleCopyMessage = useCallback(async (text: string) => {
    await Clipboard.setStringAsync(text);
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({animated: true});
    setIsScrolledUp(false);
  }, []);

  const handleFilesSelected = useCallback(
    (files: SelectedFile[]) => {
      onAttachFiles?.(files);
    },
    [onAttachFiles]
  );

  return (
    <Box direction="row" flex="grow" testID={testID}>
      {/* Sidebar */}
      <Box border="default" color="base" minWidth={250} overflow="scrollY" padding={3} width="30%">
        <Box alignItems="center" direction="row" justifyContent="between" marginBottom={3}>
          <Heading size="sm">Chats</Heading>
          <Box direction="row" gap={1}>
            {mcpServers && mcpServers.length > 0 ? (
              <MCPStatusIndicator servers={mcpServers} />
            ) : null}
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
          {currentMessages.map((message, index) => {
            // Tool call/result messages
            if (message.role === "tool-call" && message.toolCall) {
              return (
                <Box alignItems="start" key={`msg-${index}`} maxWidth="80%">
                  <ToolCallCard toolCall={message.toolCall} />
                </Box>
              );
            }
            if (message.role === "tool-result" && message.toolResult) {
              return (
                <Box alignItems="start" key={`msg-${index}`} maxWidth="80%">
                  <ToolResultCard toolResult={message.toolResult} />
                </Box>
              );
            }

            return (
              <Box alignItems={message.role === "user" ? "end" : "start"} key={`msg-${index}`}>
                <Box
                  color={message.role === "user" ? "primary" : "neutralLight"}
                  maxWidth="80%"
                  padding={3}
                  rounding="lg"
                >
                  {/* Render content parts (images, files) */}
                  {message.contentParts && message.contentParts.length > 0 ? (
                    <Box marginBottom={message.content ? 2 : 0}>
                      <MessageContentParts
                        parts={message.contentParts.filter((p) => p.type !== "text")}
                      />
                    </Box>
                  ) : null}

                  {/* Render text content */}
                  {message.role === "assistant" ? (
                    <MarkdownView>{message.content}</MarkdownView>
                  ) : (
                    <Text color={message.role === "user" ? "inverted" : "primary"}>
                      {message.content}
                    </Text>
                  )}

                  {/* Copy button */}
                  {message.role === "assistant" ? (
                    <Box alignItems="end" marginTop={1}>
                      <IconButton
                        accessibilityLabel="Copy message"
                        iconName="copy"
                        onClick={() => handleCopyMessage(message.content)}
                        testID={`gpt-copy-msg-${index}`}
                      />
                    </Box>
                  ) : null}
                </Box>
              </Box>
            );
          })}
          {isStreaming ? (
            <Box alignItems="start" padding={2}>
              <Spinner size="sm" />
            </Box>
          ) : null}
        </Box>

        {/* Scroll to bottom button */}
        {isScrolledUp && isStreaming ? (
          <Box alignItems="center" marginBottom={2}>
            <Button
              iconName="arrow-down"
              onClick={scrollToBottom}
              text="Scroll to bottom"
              variant="outline"
            />
          </Box>
        ) : null}

        {/* Attachment preview */}
        {attachments.length > 0 && onRemoveAttachment ? (
          <AttachmentPreview attachments={attachments} onRemove={onRemoveAttachment} />
        ) : null}

        {/* Input */}
        <Box alignItems="end" direction="row" gap={2}>
          {onAttachFiles ? (
            <FilePickerButton
              disabled={isStreaming}
              onFilesSelected={handleFilesSelected}
              testID="gpt-attach-button"
            />
          ) : null}
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
