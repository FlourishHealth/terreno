import {AIRequestExplorer, type AIRequestExplorerData, Page} from "@terreno/ui";
import React, {useCallback, useState} from "react";
import {useGetAiRequestsExplorerQuery} from "@/store";

const EXPLORER_LIMIT = 20;

const AIAdminScreen: React.FC = () => {
  const [page, setPage] = useState(1);
  const [requestTypeFilter, setRequestTypeFilter] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const {data: explorerData, isLoading} = useGetAiRequestsExplorerQuery({
    endDate: endDate || undefined,
    limit: EXPLORER_LIMIT,
    page,
    requestType: requestTypeFilter.length === 1 ? requestTypeFilter[0] : undefined,
    startDate: startDate || undefined,
  });

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleRequestTypeFilterChange = useCallback((types: string[]) => {
    setRequestTypeFilter(types);
    setPage(1);
  }, []);

  const handleStartDateChange = useCallback((date: string) => {
    setStartDate(date);
    setPage(1);
  }, []);

  const handleEndDateChange = useCallback((date: string) => {
    setEndDate(date);
    setPage(1);
  }, []);

  const explorerItems: AIRequestExplorerData[] = (explorerData?.data ?? []).map((item) => ({
    aiModel: item.aiModel,
    created: item.created,
    error: item.error,
    prompt: item.prompt,
    requestType: item.requestType,
    response: item.response,
    responseTime: item.responseTime,
    tokensUsed: item.tokensUsed,
    user: item.user,
  }));

  const explorerTotal = explorerData?.total ?? 0;
  const explorerTotalPages = Math.ceil(explorerTotal / EXPLORER_LIMIT);

  return (
    <Page maxWidth="100%" scroll title="AI Request Explorer">
      <AIRequestExplorer
        data={explorerItems}
        endDate={endDate}
        isLoading={isLoading}
        onEndDateChange={handleEndDateChange}
        onPageChange={handlePageChange}
        onRequestTypeFilterChange={handleRequestTypeFilterChange}
        onStartDateChange={handleStartDateChange}
        page={page}
        requestTypeFilter={requestTypeFilter}
        startDate={startDate}
        testID="admin-ai-explorer"
        totalCount={explorerTotal}
        totalPages={explorerTotalPages}
      />
    </Page>
  );
};

export default AIAdminScreen;
