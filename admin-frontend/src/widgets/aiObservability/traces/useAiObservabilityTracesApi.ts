import {useMemo} from "react";
import {asDynamicHookApi} from "../../../dynamicHookApi";
import type {AdminApi, EndpointBuilder} from "../../../types";
import type {TraceDetail, TraceListFilters, TraceListResponse} from "./traceTypes";
import {TRACE_PAGE_SIZE} from "./traceTypes";

const LIST_KEY = "aiObservabilityTraces";
const DETAIL_KEY = "aiObservabilityTrace";
const EVALUATORS_KEY = "aiObservabilityEvaluators";
const REVIEW_KEY = "enqueueAiObservabilityReview";

export interface TraceListQueryArgs extends TraceListFilters {
  limit?: number;
  page?: number;
}

const listParams = (args: TraceListQueryArgs): Record<string, unknown> => {
  const params: Record<string, unknown> = {
    limit: args.limit ?? TRACE_PAGE_SIZE,
    page: args.page ?? 1,
  };
  if (args.from.trim()) {
    params.from = args.from.trim();
  }
  if (args.prompt.trim()) {
    params.prompt = args.prompt.trim();
  }
  if (args.to.trim()) {
    params.to = args.to.trim();
  }
  if (args.sessionId.trim()) {
    params.sessionId = args.sessionId.trim();
  }
  if (args.status) {
    params.status = args.status;
  }
  if (args.userId.trim()) {
    params.userId = args.userId.trim();
  }
  if (args.flaggedForDataset !== undefined) {
    params.flaggedForDataset = args.flaggedForDataset;
  }
  if (args.hasScore !== undefined) {
    params.hasScore = args.hasScore;
  }
  if (args.sensitive !== undefined) {
    params.sensitive = args.sensitive;
  }
  return params;
};

const createTracesApi = (api: AdminApi) => {
  const tagged =
    typeof api.enhanceEndpoints === "function"
      ? api.enhanceEndpoints({
          addTagTypes: ["aiObservabilityReview", "aiObservabilityTraces"],
        })
      : api;
  return tagged.injectEndpoints({
    endpoints: (build: EndpointBuilder) => ({
      [LIST_KEY]: build.query({
        providesTags: ["aiObservabilityTraces"],
        query: (args: TraceListQueryArgs) => ({
          method: "GET",
          params: listParams(args),
          url: "/ai/observability/traces",
        }),
      }),
      [DETAIL_KEY]: build.query({
        query: (id: string) => ({
          method: "GET",
          url: `/ai/observability/traces/${encodeURIComponent(id)}`,
        }),
      }),
      [EVALUATORS_KEY]: build.query({
        query: () => ({
          method: "GET",
          url: "/ai/observability/evaluators",
        }),
      }),
      [REVIEW_KEY]: build.mutation({
        invalidatesTags: ["aiObservabilityReview", "aiObservabilityTraces"],
        query: (body: {evaluatorId: string; reason: "manual"; traceIds: string[]}) => ({
          body,
          method: "POST",
          url: "/ai/observability/traces/review",
        }),
      }),
    }),
    overrideExisting: true,
  });
};

interface QueryOptions {
  skip?: boolean;
}

export const useAiObservabilityTracesApi = (api: AdminApi) => {
  const enhancedApi = useMemo(() => {
    return createTracesApi(api);
  }, [api]);
  const hooks = asDynamicHookApi(enhancedApi);
  return {
    useDetailQuery: hooks.useAiObservabilityTraceQuery as (
      id: string,
      options?: QueryOptions
    ) => {
      data?: TraceDetail | {data: TraceDetail};
      isError: boolean;
      isLoading: boolean;
      refetch: () => void;
    },
    useEnqueueReviewMutation: hooks.useEnqueueAiObservabilityReviewMutation as () => [
      (body: {evaluatorId: string; reason: "manual"; traceIds: string[]}) => {
        unwrap: () => Promise<unknown>;
      },
      {isError: boolean; isLoading: boolean},
    ],
    useEvaluatorsQuery: hooks.useAiObservabilityEvaluatorsQuery as () => {
      data?: unknown;
      isLoading: boolean;
    },
    useListQuery: hooks.useAiObservabilityTracesQuery as (args: TraceListQueryArgs) => {
      data?: TraceListResponse | TraceListResponse["data"];
      isError: boolean;
      isLoading: boolean;
      refetch: () => void;
    },
  };
};
