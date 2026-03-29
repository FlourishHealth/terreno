import type {MCPToolInfo, UseMCPToolsResult} from "@terreno/rtk";
import {Badge, Box, Button, Card, Page, Spinner, Text, TextField} from "@terreno/ui";
import type React from "react";
import {useCallback, useRef, useState} from "react";
import {FlatList, type ListRenderItem} from "react-native";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AdminMCPChatProps {
  /** Hook result from useMCPTools(). */
  mcpTools: UseMCPToolsResult;
  /** The sendMessage function from useTerrenoChat(). */
  sendMessage: (message: {content: string; role: "user"}) => Promise<void>;
  /** Chat messages from useTerrenoChat(). */
  messages: Array<{id?: string; role: string; content: string | unknown}>;
  /** Status from useTerrenoChat() – "streaming", "submitted", etc. */
  status: string;
}

const MessageBubble: React.FC<{message: ChatMessage}> = ({message}) => {
  const isUser = message.role === "user";

  return (
    <Box
      alignItems={isUser ? "end" : "start"}
      marginBottom={2}
      testID={`mcp-chat-message-${message.id}`}
    >
      <Card color={isUser ? "primary" : "base"} padding={3} rounding="lg" style={{maxWidth: "80%"}}>
        <Text color={isUser ? "inverted" : "primary"} size="md">
          {message.content}
        </Text>
      </Card>
    </Box>
  );
};

const ToolList: React.FC<{mcpTools: UseMCPToolsResult}> = ({mcpTools}) => {
  const {tools, isLoading, error} = mcpTools;

  if (isLoading) {
    return (
      <Box padding={2}>
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={2}>
        <Text color="error" size="sm">
          Failed to load tools: {error}
        </Text>
      </Box>
    );
  }

  if (tools.length === 0) {
    return (
      <Box padding={2}>
        <Text color="secondaryLight" size="sm">
          No MCP tools available. Add mcp config to your modelRouters.
        </Text>
      </Box>
    );
  }

  return (
    <Box direction="row" gap={2} padding={2} wrap>
      {tools.map((tool: MCPToolInfo) => (
        <Badge key={tool.name} text={tool.name} />
      ))}
    </Box>
  );
};

/**
 * Admin screen for chatting with AI using MCP tools from your backend's modelRouters.
 *
 * This is a reusable component meant to be used within the admin panel.
 * The caller is responsible for providing the MCP tools and chat hooks,
 * keeping this package free of hard dependencies on AI SDK transports.
 *
 * @example
 * ```typescript
 * import {AdminMCPChat} from "@terreno/admin-frontend";
 * import {useMCPTools, useTerrenoChat} from "@terreno/rtk";
 *
 * const MCPChatScreen: React.FC = () => {
 *   const mcpTools = useMCPTools();
 *   const {messages, sendMessage, status} = useTerrenoChat({apiPath: "/api/chat"});
 *   return (
 *     <AdminMCPChat
 *       mcpTools={mcpTools}
 *       messages={messages}
 *       sendMessage={sendMessage}
 *       status={status}
 *     />
 *   );
 * };
 * ```
 */
export const AdminMCPChat: React.FC<AdminMCPChatProps> = ({
  mcpTools,
  sendMessage,
  messages,
  status,
}) => {
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const isLoading = status === "streaming" || status === "submitted";

  const chatMessages: ChatMessage[] = messages.map((msg, i) => ({
    content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
    id: msg.id || String(i),
    role: msg.role === "user" ? "user" : "assistant",
  }));

  const handleSend = useCallback(async (): Promise<void> => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) {
      return;
    }
    setInput("");
    try {
      await sendMessage({content: trimmed, role: "user"});
    } catch (err) {
      console.error("Error sending message:", err);
    }
  }, [input, isLoading, sendMessage]);

  const renderMessage: ListRenderItem<ChatMessage> = useCallback(
    ({item}) => <MessageBubble message={item} />,
    []
  );

  const keyExtractor = useCallback((item: ChatMessage): string => item.id, []);

  return (
    <Page maxWidth={800} scroll testID="admin-mcp-chat-screen" title="MCP Chat">
      <Box flex="grow" padding={4}>
        <Box marginBottom={4}>
          <Text color="secondaryLight" size="sm">
            Chat with AI using MCP tools from your modelRouters
          </Text>
        </Box>

        <Box marginBottom={3}>
          <Text color="secondaryLight" size="sm">
            Available tools:
          </Text>
          <ToolList mcpTools={mcpTools} />
        </Box>

        <Box flex="grow" marginBottom={3}>
          {chatMessages.length === 0 ? (
            <Box alignItems="center" flex="grow" justifyContent="center">
              <Text color="secondaryLight" testID="mcp-chat-empty">
                Send a message to get started. The AI can use MCP tools to query your data.
              </Text>
            </Box>
          ) : (
            <FlatList
              data={chatMessages}
              keyExtractor={keyExtractor}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({animated: true})}
              ref={flatListRef}
              renderItem={renderMessage}
              style={{flex: 1}}
              testID="mcp-chat-messages"
            />
          )}
        </Box>

        <Box direction="row" gap={2}>
          <Box flex="grow">
            <TextField
              disabled={isLoading}
              onChange={setInput}
              onEnter={handleSend}
              placeholder="Ask about your data..."
              testID="mcp-chat-input"
              value={input}
            />
          </Box>
          <Button
            disabled={!input.trim() || isLoading}
            iconName="paper-plane"
            loading={isLoading}
            onClick={handleSend}
            testID="mcp-chat-send-button"
            text="Send"
          />
        </Box>
      </Box>
    </Page>
  );
};
