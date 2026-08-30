import {AIRequestExplorer, type AIRequestExplorerData} from "@terreno/ui";
import React, {useCallback, useMemo, useState} from "react";
import {AdminScreenPage} from "../AdminScreenPage";
import {asDynamicHookApi} from "../dynamicHookApi";
import type {AdminScreenWidgetProps, EndpointBuilder, ScreenWidgetComponent} from "../types";

const EXPLORER_LIMIT = 20;
const AI_REQUESTS_ENDPOINT_KEY = "adminAiRequestsExplorer";

interface AIRequestsResponse {
  data: AIRequestExplorerData[];
  limit: number;
  more: boolean;
  page: number;
  total: number;
}

export const AIRequestsScreenWidget: React.FC<AdminScreenWidgetProps> = ({api}) => {
  const [page, setPage] = useState(1);
  const [requestTypeFilter, setRequestTypeFilter] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const enhancedApi = useMemo(
    () =>
      api.injectEndpoints({
        endpoints: (build: EndpointBuilder) => ({
          [AI_REQUESTS_ENDPOINT_KEY]: build.query({
            query: (params: Record<string, unknown>) => ({
              method: "GET",
              params,
              url: "/aiRequestsExplorer",
            }),
          }),
        }),
        overrideExisting: true,
      }),
    [api]
  );

  const useExplorerQuery = asDynamicHookApi(enhancedApi).useAdminAiRequestsExplorerQuery;
  const {data, isLoading} = useExplorerQuery({
    endDate: endDate || undefined,
    limit: EXPLORER_LIMIT,
    page,
    requestType: requestTypeFilter.length > 0 ? requestTypeFilter.join(",") : undefined,
    startDate: startDate || undefined,
  }) as {data?: AIRequestsResponse; isLoading: boolean};

  const handlePageChange = useCallback((nextPage: number): void => {
    setPage(nextPage);
  }, []);

  const handleRequestTypeFilterChange = useCallback((types: string[]): void => {
    setRequestTypeFilter(types);
    setPage(1);
  }, []);

  const handleStartDateChange = useCallback((value: string): void => {
    setStartDate(value);
    setPage(1);
  }, []);

  const handleEndDateChange = useCallback((value: string): void => {
    setEndDate(value);
    setPage(1);
  }, []);

  const total = data?.total ?? 0;

  return (
    <AdminScreenPage maxWidth="100%" scroll title="AI Request Explorer">
      <AIRequestExplorer
        data={data?.data ?? []}
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
        totalCount={total}
        totalPages={Math.ceil(total / EXPLORER_LIMIT)}
      />
    </AdminScreenPage>
  );
};

export const AI_ADMIN_WIDGETS: Record<string, ScreenWidgetComponent> = {
  "ai-requests": AIRequestsScreenWidget,
};
