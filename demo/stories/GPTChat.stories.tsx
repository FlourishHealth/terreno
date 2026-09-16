import type {GPTChatHistory, GPTChatMessage} from "@terreno/ui";
import {Box, GPTChat, Heading, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";

const STATIC_HISTORIES: GPTChatHistory[] = [
  {id: "h1", prompts: [], title: "Onboarding questions"},
  {id: "h2", prompts: [], title: "API design"},
];

const STATIC_MESSAGES: GPTChatMessage[] = [
  {content: "How do I add a new synced collection?", role: "user"},
  {
    content:
      "Add `syncPlugin` and `isDeletedPlugin` to the model, then pass a `sync` config to `modelRouter`. No live backend is required for this demo.",
    role: "assistant",
  },
];

const CANNED_ASSISTANT_REPLY =
  "This demo uses a static message list. Submit appends a canned reply locally — there is no AI backend.";

const noop = (): void => {};

const GPTChatFrame: React.FC<{children: React.ReactNode}> = ({children}) => {
  return (
    <Box height={480} overflow="hidden" width="100%">
      {children}
    </Box>
  );
};

export const GPTChatDemo: React.FC = (): React.ReactElement => {
  const [messages, setMessages] = useState<GPTChatMessage[]>(STATIC_MESSAGES);
  const [historyId, setHistoryId] = useState<string>("h1");

  const handleSubmit = useCallback((prompt: string): void => {
    setMessages((current) => [
      ...current,
      {content: prompt, role: "user"},
      {content: CANNED_ASSISTANT_REPLY, role: "assistant"},
    ]);
  }, []);

  const handleSelectHistory = useCallback((id: string): void => {
    setHistoryId(id);
  }, []);

  const handleCreateHistory = useCallback((): void => {
    setHistoryId("h-new");
    setMessages([]);
  }, []);

  return (
    <GPTChatFrame>
      <GPTChat
        currentHistoryId={historyId}
        currentMessages={messages}
        histories={STATIC_HISTORIES}
        onCreateHistory={handleCreateHistory}
        onDeleteHistory={noop}
        onSelectHistory={handleSelectHistory}
        onSubmit={handleSubmit}
        suggestedPrompts={["Summarize the last answer", "Show a code sample"]}
        testID="demo-gpt-chat"
      />
    </GPTChatFrame>
  );
};

export const GPTChatEmpty: React.FC = (): React.ReactElement => {
  return (
    <Box gap={2} width="100%">
      <Heading size="sm">Empty</Heading>
      <Text>No messages — suggested prompts only. No backend.</Text>
      <GPTChatFrame>
        <GPTChat
          currentMessages={[]}
          histories={STATIC_HISTORIES}
          onCreateHistory={noop}
          onDeleteHistory={noop}
          onSelectHistory={noop}
          onSubmit={noop}
          suggestedPrompts={["What can this chat do?", "Explain SplitPage"]}
          testID="demo-gpt-chat-empty"
        />
      </GPTChatFrame>
    </Box>
  );
};

export const GPTChatStreaming: React.FC = (): React.ReactElement => {
  return (
    <Box gap={2} width="100%">
      <Heading size="sm">Streaming</Heading>
      <Text>Assistant is streaming. Input submit is ignored while `isStreaming` is true.</Text>
      <GPTChatFrame>
        <GPTChat
          currentHistoryId="h1"
          currentMessages={[...STATIC_MESSAGES, {content: "Drafting a reply", role: "assistant"}]}
          histories={STATIC_HISTORIES}
          isStreaming
          onCreateHistory={noop}
          onDeleteHistory={noop}
          onSelectHistory={noop}
          onSubmit={noop}
          testID="demo-gpt-chat-streaming"
        />
      </GPTChatFrame>
    </Box>
  );
};
