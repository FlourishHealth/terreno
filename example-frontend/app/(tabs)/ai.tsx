import {baseUrl, getAuthToken} from "@terreno/rtk";
import {
  Box,
  GPTChat,
  type GPTChatHistory,
  type GPTChatMessage,
  Spinner,
  useStoredState,
} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";
import {
  type GptHistory,
  useDeleteGptHistoriesByIdMutation,
  useGetGptHistoriesQuery,
  usePatchGptHistoriesByIdMutation,
} from "@/store";

const mapHistoryToChat = (history: GptHistory): GPTChatHistory => ({
  id: history.id,
  prompts: history.prompts.map((p) => ({
    content: p.text,
    role: p.type,
    ...(p.toolCallId && p.type === "tool-call"
      ? {toolCall: {args: p.args ?? {}, toolCallId: p.toolCallId, toolName: p.toolName ?? ""}}
      : {}),
    ...(p.toolCallId && p.type === "tool-result"
      ? {toolResult: {result: p.result, toolCallId: p.toolCallId, toolName: p.toolName ?? ""}}
      : {}),
  })),
  title: history.title,
  updated: history.updated,
});

const AiScreen: React.FC = () => {
  const [currentHistoryId, setCurrentHistoryId] = useState<string | undefined>(undefined);
  const [currentMessages, setCurrentMessages] = useState<GPTChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [geminiApiKey] = useStoredState<string>("geminiApiKey", "");

  const {data: historiesData, isLoading} = useGetGptHistoriesQuery();
  const [deleteHistory] = useDeleteGptHistoriesByIdMutation();
  const [patchHistory] = usePatchGptHistoriesByIdMutation();

  const histories: GPTChatHistory[] = (historiesData?.data ?? []).map(mapHistoryToChat);

  const handleSelectHistory = useCallback(
    (id: string) => {
      const history = histories.find((h) => h.id === id);
      if (history) {
        setCurrentHistoryId(id);
        setCurrentMessages(history.prompts);
      }
    },
    [histories]
  );

  const handleCreateHistory = useCallback(() => {
    setCurrentHistoryId(undefined);
    setCurrentMessages([]);
  }, []);

  const handleDeleteHistory = useCallback(
    async (id: string) => {
      try {
        await deleteHistory({id}).unwrap();
        if (currentHistoryId === id) {
          setCurrentHistoryId(undefined);
          setCurrentMessages([]);
        }
      } catch (err) {
        console.error("Error deleting history:", err);
      }
    },
    [deleteHistory, currentHistoryId]
  );

  const handleUpdateTitle = useCallback(
    async (id: string, title: string) => {
      try {
        await patchHistory({body: {title}, id}).unwrap();
      } catch (err) {
        console.error("Error updating history title:", err);
      }
    },
    [patchHistory]
  );

  const handleSubmit = useCallback(
    async (prompt: string) => {
      const userMessage: GPTChatMessage = {content: prompt, role: "user"};
      setCurrentMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);

      try {
        const token = await getAuthToken();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };
        if (geminiApiKey) {
          headers["x-ai-api-key"] = geminiApiKey;
        }
        const response = await fetch(`${baseUrl}/gpt/prompt`, {
          body: JSON.stringify({historyId: currentHistoryId, prompt}),
          headers,
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let assistantText = "";
        let buffer = "";

        // Add initial empty assistant message
        setCurrentMessages((prev) => [...prev, {content: "", role: "assistant"}]);

        while (true) {
          const {done, value} = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, {stream: true});
          const lines = buffer.split("\n");
          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) {
              continue;
            }

            try {
              const data = JSON.parse(trimmed.slice(6));

              if (data.text) {
                assistantText += data.text;
                const updatedText = assistantText;
                setCurrentMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                    updated[lastIdx] = {...updated[lastIdx], content: updatedText};
                  }
                  return updated;
                });
              } else if (data.toolCall) {
                setCurrentMessages((prev) => [
                  ...prev,
                  {
                    content: `Tool call: ${data.toolCall.toolName}`,
                    role: "tool-call",
                    toolCall: data.toolCall,
                  },
                ]);
                // Add a new empty assistant message for continued text after tool results
                assistantText = "";
                setCurrentMessages((prev) => [...prev, {content: "", role: "assistant"}]);
              } else if (data.toolResult) {
                // Insert tool result before the last empty assistant message
                setCurrentMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (
                    lastIdx >= 0 &&
                    updated[lastIdx].role === "assistant" &&
                    !updated[lastIdx].content
                  ) {
                    updated.splice(lastIdx, 0, {
                      content: `Tool result: ${data.toolResult.toolName}`,
                      role: "tool-result",
                      toolResult: data.toolResult,
                    });
                  }
                  return updated;
                });
              } else if (data.done) {
                // Clean up trailing empty assistant messages
                setCurrentMessages((prev) =>
                  prev.filter((m) => m.content || m.role !== "assistant")
                );
                if (data.historyId) {
                  setCurrentHistoryId(data.historyId);
                }
              } else if (data.error) {
                console.error("SSE error:", data.error);
                setCurrentMessages((prev) => [
                  ...prev.filter((m) => m.content || m.role !== "assistant"),
                  {content: `Error: ${data.error}`, role: "assistant"},
                ]);
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      } catch (err) {
        console.error("Error sending prompt:", err);
        setCurrentMessages((prev) => [
          ...prev.filter((m) => m.content || m.role !== "assistant"),
          {content: "Failed to get response. Please try again.", role: "assistant"},
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [currentHistoryId, geminiApiKey]
  );

  if (isLoading) {
    return (
      <Box alignItems="center" flex="grow" justifyContent="center">
        <Spinner />
      </Box>
    );
  }

  return (
    <GPTChat
      currentHistoryId={currentHistoryId}
      currentMessages={currentMessages}
      histories={histories}
      isStreaming={isStreaming}
      onCreateHistory={handleCreateHistory}
      onDeleteHistory={handleDeleteHistory}
      onSelectHistory={handleSelectHistory}
      onSubmit={handleSubmit}
      onUpdateTitle={handleUpdateTitle}
      testID="chat"
    />
  );
};

export default AiScreen;
