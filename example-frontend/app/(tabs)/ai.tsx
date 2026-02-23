import {baseUrl, getAuthToken} from "@terreno/rtk";
import {
  Box,
  GPTChat,
  type GPTChatHistory,
  type GPTChatMessage,
  type MessageContentPart,
  type SelectedFile,
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
    contentParts: p.content?.map((c): MessageContentPart => {
      if (c.type === "text") {
        return {text: c.text ?? "", type: "text"};
      }
      if (c.type === "image") {
        return {mimeType: c.mimeType, type: "image", url: c.url ?? ""};
      }
      return {filename: c.filename, mimeType: c.mimeType ?? "", type: "file", url: c.url ?? ""};
    }),
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

const IMAGE_MIME_PREFIXES = ["image/"];

const isImageMimeType = (mimeType: string): boolean =>
  IMAGE_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));

const readFileAsBase64DataUrl = async (uri: string, _mimeType: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const AiScreen: React.FC = () => {
  const [currentHistoryId, setCurrentHistoryId] = useState<string | undefined>(undefined);
  const [currentMessages, setCurrentMessages] = useState<GPTChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [geminiApiKey, setGeminiApiKey] = useStoredState<string>("geminiApiKey", "");
  const [attachments, setAttachments] = useState<SelectedFile[]>([]);

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

  const handleAttachFiles = useCallback((files: SelectedFile[]) => {
    setAttachments((prev) => [...prev, ...files]);
  }, []);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(
    async (prompt: string) => {
      const currentAttachments = [...attachments];
      setAttachments([]);

      // Build content parts for display in the chat from attached files
      const userContentParts: GPTChatMessage["contentParts"] = currentAttachments.map((file) => ({
        filename: file.name,
        mimeType: file.mimeType,
        type: isImageMimeType(file.mimeType) ? ("image" as const) : ("file" as const),
        url: file.uri,
      }));

      const userMessage: GPTChatMessage = {
        content: prompt,
        contentParts: userContentParts.length > 0 ? userContentParts : undefined,
        role: "user",
      };
      setCurrentMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);

      try {
        // Convert local file URIs to base64 data URLs for the API
        const apiAttachments = await Promise.all(
          currentAttachments.map(async (file) => {
            const dataUrl = await readFileAsBase64DataUrl(file.uri, file.mimeType);
            return {
              filename: file.name,
              mimeType: file.mimeType,
              type: isImageMimeType(file.mimeType) ? "image" : "file",
              url: dataUrl,
            };
          })
        );

        const token = await getAuthToken();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };
        if (geminiApiKey) {
          headers["x-ai-api-key"] = geminiApiKey;
        }
        const response = await fetch(`${baseUrl}/gpt/prompt`, {
          body: JSON.stringify({
            attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
            historyId: currentHistoryId,
            prompt,
          }),
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
                  // Update existing assistant message or create one
                  if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                    updated[lastIdx] = {...updated[lastIdx], content: updatedText};
                  } else {
                    updated.push({content: updatedText, role: "assistant"});
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
              } else if (data.image || data.file) {
                const part = data.image
                  ? {mimeType: data.image.mimeType, type: "image" as const, url: data.image.url}
                  : {
                      filename: data.file.filename,
                      mimeType: data.file.mimeType,
                      type: (typeof data.file.mimeType === "string" &&
                      data.file.mimeType.startsWith("image/")
                        ? "image"
                        : "file") as "image" | "file",
                      url: data.file.url,
                    };
                setCurrentMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                    const existing = updated[lastIdx].contentParts ?? [];
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      contentParts: [...existing, part],
                    };
                  } else {
                    updated.push({content: "", contentParts: [part], role: "assistant"});
                  }
                  return updated;
                });
              } else if (data.done) {
                // Clean up trailing empty assistant messages
                setCurrentMessages((prev) =>
                  prev.filter(
                    (m) =>
                      m.content ||
                      (m.contentParts && m.contentParts.length > 0) ||
                      m.role !== "assistant"
                  )
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
    [attachments, currentHistoryId, geminiApiKey]
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
      attachments={attachments}
      currentHistoryId={currentHistoryId}
      currentMessages={currentMessages}
      geminiApiKey={geminiApiKey}
      histories={histories}
      isStreaming={isStreaming}
      onAttachFiles={handleAttachFiles}
      onCreateHistory={handleCreateHistory}
      onDeleteHistory={handleDeleteHistory}
      onGeminiApiKeyChange={setGeminiApiKey}
      onRemoveAttachment={handleRemoveAttachment}
      onSelectHistory={handleSelectHistory}
      onSubmit={handleSubmit}
      onUpdateTitle={handleUpdateTitle}
      testID="chat"
    />
  );
};

export default AiScreen;
