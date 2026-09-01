import {router} from "expo-router";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import type {AdminScreenWidgetProps} from "../../../types";
import {AiObservabilityChrome} from "../shell/AiObservabilityChrome";
import {AiTracesListView} from "./AiTracesListView";
import {
  emptyTraceFilters,
  TRACE_PAGE_SIZE,
  type TraceListFilters,
  unwrapEvaluators,
  unwrapTraceList,
} from "./traceTypes";
import {useAiObservabilityTracesApi} from "./useAiObservabilityTracesApi";

export const AiTracesScreenWidget: React.FC<AdminScreenWidgetProps> = (props) => {
  const {api, routeBase} = props;
  const {useEnqueueReviewMutation, useEvaluatorsQuery, useListQuery} =
    useAiObservabilityTracesApi(api);
  const [filters, setFilters] = useState<TraceListFilters>(emptyTraceFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [evaluatorId, setEvaluatorId] = useState("");
  const [enqueueError, setEnqueueError] = useState("");

  const {data, isError, isLoading} = useListQuery({
    ...filters,
    limit: TRACE_PAGE_SIZE,
    page,
  });
  const {data: evaluatorsRaw} = useEvaluatorsQuery();
  const [enqueueReview, enqueueState] = useEnqueueReviewMutation();

  const listed = useMemo(() => unwrapTraceList(data), [data]);
  const evaluators = useMemo(() => unwrapEvaluators(evaluatorsRaw), [evaluatorsRaw]);
  const prefix = (routeBase ?? "").replace(/\/$/, "");

  // Use the first installed evaluator so Send to review queue does not require a hidden pick.
  useEffect(() => {
    const first = evaluators[0];
    if (evaluatorId || !first) {
      return;
    }
    setEvaluatorId(first.id);
  }, [evaluatorId, evaluators]);

  const handleFiltersChange = useCallback((next: TraceListFilters): void => {
    setFilters(next);
    setPage(1);
    setSelectedIds([]);
  }, []);

  const handleToggleSelect = useCallback((id: string): void => {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((entry) => entry !== id);
      }
      return [...current, id];
    });
  }, []);

  const handleClearSelection = useCallback((): void => {
    setSelectedIds([]);
  }, []);

  const handleOpenTrace = useCallback(
    (id: string): void => {
      router.push(`${prefix}/ai-trace-detail?id=${encodeURIComponent(id)}`);
    },
    [prefix]
  );

  const handleEnqueueReview = useCallback(async (): Promise<void> => {
    if (!evaluatorId || selectedIds.length === 0) {
      return;
    }
    setEnqueueError("");
    try {
      await enqueueReview({
        evaluatorId,
        reason: "manual",
        traceIds: selectedIds,
      }).unwrap();
      setSelectedIds([]);
    } catch {
      setEnqueueError("Could not send traces to the review queue.");
    }
  }, [enqueueReview, evaluatorId, selectedIds]);

  return (
    <AiObservabilityChrome {...props} screenName="ai-traces">
      <AiTracesListView
        enqueueError={enqueueError || (isError ? "Failed to load traces." : undefined)}
        evaluatorId={evaluatorId}
        evaluators={evaluators}
        filters={filters}
        isEnqueueing={enqueueState.isLoading}
        isLoading={isLoading}
        more={listed.more}
        onClearSelection={handleClearSelection}
        onEnqueueReview={handleEnqueueReview}
        onEvaluatorChange={setEvaluatorId}
        onFiltersChange={handleFiltersChange}
        onOpenTrace={handleOpenTrace}
        onPageChange={setPage}
        onToggleSelect={handleToggleSelect}
        page={page}
        pageSize={listed.limit}
        selectedIds={selectedIds}
        total={listed.total}
        traces={listed.data}
      />
    </AiObservabilityChrome>
  );
};
