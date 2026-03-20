import {useMCPTools, useTerrenoChat} from "@terreno/rtk";
import {Badge, Box, Button, Card, Heading, Page, Spinner, Text, TextField} from "@terreno/ui";
import type React from "react";
import {useCallback, useRef, useState} from "react";
import {FlatList, type ListRenderItem} from "react-native";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
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

const ToolList: React.FC = () => {
  const {tools, isLoading, error} = useMCPTools();

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
      {tools.map((tool) => (
        <Badge key={tool.name} text={tool.name} />
      ))}
    </Box>
  );
};

const MCPChatScreen: React.FC = () => {
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const {messages, sendMessage, status} = useTerrenoChat({
    apiPath: "/api/chat",
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Convert AI SDK messages to our simple format
  const chatMessages: ChatMessage[] = messages.map((msg, i) => ({
    content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
    id: msg.id || String(i),
    role: msg.role === "user" ? "user" : "assistant",
  }));

  const handleSend = useCallback(async () => {
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

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  return (
    <Page navigation={undefined} testID="mcp-chat-screen">
      <Box flex="grow" padding={4}>
        <Box marginBottom={4}>
          <Heading size="xl">MCP Chat</Heading>
          <Text color="secondaryLight" size="sm">
            Chat with AI using MCP tools from your modelRouters
          </Text>
        </Box>

        <Box marginBottom={3}>
          <Text color="secondaryLight" size="sm">
            Available tools:
          </Text>
          <ToolList />
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

export default MCPChatScreen;
