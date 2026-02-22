import {baseUrl, getAuthToken} from "@terreno/rtk";
import {
  AIRequestExplorer,
  Box,
  GPTChat,
  type GPTChatHistory,
  type GPTChatMessage,
  Heading,
  Page,
  SegmentedControl,
} from "@terreno/ui";
import type React from "react";
import {useCallback, useRef, useState} from "react";
import {
  useDeleteGptHistoriesByIdMutation,
  useGetAiRequestsExplorerQuery,
  useGetGptHistoriesByIdQuery,
  useGetGptHistoriesQuery,
  usePostGptHistoriesMutation,
} from "@/store";

const TABS = ["GPT Chat", "AI Requests"];

const AIRequestsTab: React.FC = () => {
  const [page, setPage] = useState(1);
  const [requestTypeFilter, setRequestTypeFilter] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const {data, isLoading} = useGetAiRequestsExplorerQuery({
    endDate: endDate || undefined,
    limit: 20,
    page,
    requestType: requestTypeFilter.length === 1 ? requestTypeFilter[0] : undefined,
    startDate: startDate || undefined,
  });

  return (
    <AIRequestExplorer
      data={data?.data ?? []}
      endDate={endDate}
      isLoading={isLoading}
      onEndDateChange={setEndDate}
      onPageChange={setPage}
      onRequestTypeFilterChange={setRequestTypeFilter}
      onStartDateChange={setStartDate}
      page={page}
      requestTypeFilter={requestTypeFilter}
      startDate={startDate}
      testID="admin-ai-requests"
      totalCount={data?.total ?? 0}
      totalPages={data ? Math.ceil(data.total / data.limit) : 0}
    />
  );
};

const GPTChatTab: React.FC = () => {
  const [currentHistoryId, setCurrentHistoryId] = useState<string | undefined>();
  const [streamingMessages, setStreamingMessages] = useState<GPTChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {data: historiesData} = useGetGptHistoriesQuery();
  const {data: currentHistoryData} = useGetGptHistoriesByIdQuery(
    {id: currentHistoryId ?? ""},
    {skip: !currentHistoryId}
  );
  const [createHistory] = usePostGptHistoriesMutation();
  const [deleteHistory] = useDeleteGptHistoriesByIdMutation();

  const histories: GPTChatHistory[] = (historiesData?.data ?? []).map((h) => ({
    id: h.id,
    prompts: h.prompts.map((p) => ({
      content: p.text,
      role: p.type,
    })),
    title: h.title,
    updated: h.updated,
  }));

  const currentMessages: GPTChatMessage[] = currentHistoryId
    ? [
        ...(currentHistoryData?.data?.prompts ?? []).map((p) => ({
          content: p.text,
          role: p.type,
        })),
        ...streamingMessages,
      ]
    : streamingMessages;

  const handleCreateHistory = useCallback(async () => {
    try {
      const result = await createHistory().unwrap();
      setCurrentHistoryId(result.data.id);
      setStreamingMessages([]);
    } catch (err) {
      console.error("Failed to create history:", err);
    }
  }, [createHistory]);

  const handleDeleteHistory = useCallback(
    async (id: string) => {
      try {
        await deleteHistory({id}).unwrap();
        if (currentHistoryId === id) {
          setCurrentHistoryId(undefined);
          setStreamingMessages([]);
        }
      } catch (err) {
        console.error("Failed to delete history:", err);
      }
    },
    [deleteHistory, currentHistoryId]
  );

  const handleSelectHistory = useCallback((id: string) => {
    setCurrentHistoryId(id);
    setStreamingMessages([]);
  }, []);

  const handleSubmit = useCallback(
    async (prompt: string) => {
      setIsStreaming(true);
      setStreamingMessages((prev) => [...prev, {content: prompt, role: "user"}]);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const token = await getAuthToken();
        const response = await fetch(`${baseUrl}/gpt/prompt`, {
          body: JSON.stringify({historyId: currentHistoryId, prompt}),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        });

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let assistantContent = "";

        while (true) {
          const {done, value} = await reader.read();
          if (done) {
            break;
          }

          const chunk = decoder.decode(value, {stream: true});
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) {
              continue;
            }
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.text) {
                assistantContent += parsed.text;
                setStreamingMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg?.role === "assistant") {
                    updated[updated.length - 1] = {...lastMsg, content: assistantContent};
                  } else {
                    updated.push({content: assistantContent, role: "assistant"});
                  }
                  return updated;
                });
              }
              if (parsed.done && parsed.historyId) {
                setCurrentHistoryId(parsed.historyId);
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Streaming error:", err);
          setStreamingMessages((prev) => [
            ...prev,
            {content: "Error: Failed to get response", role: "assistant"},
          ]);
        }
      } finally {
        setIsStreaming(false);
        setStreamingMessages([]);
        abortControllerRef.current = null;
      }
    },
    [currentHistoryId]
  );

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
      testID="admin-gpt-chat"
    />
  );
};

const AdminScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState(0);

  return (
    <Page navigation={undefined} scroll={false}>
      <Box flex="grow" padding={4}>
        <Box marginBottom={4}>
          <Heading size="xl">Admin</Heading>
        </Box>

        <Box marginBottom={4}>
          <SegmentedControl items={TABS} onChange={setSelectedTab} selectedIndex={selectedTab} />
        </Box>

        <Box flex="grow">{selectedTab === 0 ? <GPTChatTab /> : <AIRequestsTab />}</Box>
      </Box>
    </Page>
  );
};

export default AdminScreen;
