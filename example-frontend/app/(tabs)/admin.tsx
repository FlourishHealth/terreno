import {AIRequestExplorer, type AIRequestExplorerData, Box, Heading, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";
import {useGetAiRequestsExplorerQuery, useGetMeQuery} from "@/store";

const LIMIT = 20;

const AdminScreen: React.FC = () => {
  const {data: profile} = useGetMeQuery();
  const [page, setPage] = useState(1);
  const [requestTypeFilter, setRequestTypeFilter] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const isAdmin = profile?.data?.admin === true;

  const {data: explorerData, isLoading} = useGetAiRequestsExplorerQuery(
    {
      endDate: endDate || undefined,
      limit: LIMIT,
      page,
      requestType: requestTypeFilter.length === 1 ? requestTypeFilter[0] : undefined,
      startDate: startDate || undefined,
    },
    {skip: !isAdmin}
  );

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

  if (!isAdmin) {
    return (
      <Box
        alignItems="center"
        flex="grow"
        justifyContent="center"
        padding={4}
        testID="admin-screen"
      >
        <Heading size="md">Admin Access Required</Heading>
        <Text color="secondaryDark" size="md">
          You need admin privileges to view this page.
        </Text>
      </Box>
    );
  }

  const data: AIRequestExplorerData[] = (explorerData?.data ?? []).map((item) => ({
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

  const total = explorerData?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <AIRequestExplorer
      data={data}
      endDate={endDate}
      isLoading={isLoading}
      onEndDateChange={handleEndDateChange}
      onPageChange={handlePageChange}
      onRequestTypeFilterChange={handleRequestTypeFilterChange}
      onStartDateChange={handleStartDateChange}
      page={page}
      requestTypeFilter={requestTypeFilter}
      startDate={startDate}
      testID="admin-screen"
      totalCount={total}
      totalPages={totalPages}
    />
  );
};

export default AdminScreen;
