import {router} from "expo-router";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import type {AdminScreenWidgetProps} from "../../../types";
import {unwrapDatasetList} from "../datasets/datasetTypes";
import {useAiObservabilityDatasetsApi} from "../datasets/useAiObservabilityDatasetsApi";
import {AiObservabilityChrome} from "../shell/AiObservabilityChrome";
import {unwrapObservabilityStatus} from "../shell/aiObservabilityNav";
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
  const {
    useEnqueueReviewMutation,
    useEvaluatorsQuery,
    useListQuery,
    useStatusQuery,
    useTestMultiStageMutation,
  } = useAiObservabilityTracesApi(api);
  const {useAddTracesMutation, useListQuery: useDatasetsQuery} = useAiObservabilityDatasetsApi(api);
  const [filters, setFilters] = useState<TraceListFilters>(emptyTraceFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [evaluatorId, setEvaluatorId] = useState("");
  const [enqueueError, setEnqueueError] = useState("");
  const [datasetModalOpen, setDatasetModalOpen] = useState(false);
  const [datasetId, setDatasetId] = useState("");
  const [addToDatasetError, setAddToDatasetError] = useState("");
  const [multiStageError, setMultiStageError] = useState("");

  const {data, isError, isLoading} = useListQuery({
    ...filters,
    limit: TRACE_PAGE_SIZE,
    page,
  });
  const {data: evaluatorsRaw} = useEvaluatorsQuery();
  const {data: datasetsRaw} = useDatasetsQuery();
  const {data: statusRaw} = useStatusQuery();
  const [enqueueReview, enqueueState] = useEnqueueReviewMutation();
  const [addTraces, addTracesState] = useAddTracesMutation();
  const [runTestMultiStage, testMultiStageState] = useTestMultiStageMutation();

  const listed = useMemo(() => unwrapTraceList(data), [data]);
  const evaluators = useMemo(() => unwrapEvaluators(evaluatorsRaw), [evaluatorsRaw]);
  const datasets = useMemo(() => unwrapDatasetList(datasetsRaw), [datasetsRaw]);
  const status = useMemo(() => unwrapObservabilityStatus(statusRaw), [statusRaw]);
  const prefix = (routeBase ?? "").replace(/\/$/, "");

  // Use the first installed evaluator so Send to review queue does not require a hidden pick.
  useEffect(() => {
    const first = evaluators[0];
    if (evaluatorId || !first) {
      return;
    }
    setEvaluatorId(first.id);
  }, [evaluatorId, evaluators]);

  // Default the dataset picker to the first dataset when the modal opens.
  useEffect(() => {
    const first = datasets[0];
    if (datasetId || !first || !datasetModalOpen) {
      return;
    }
    setDatasetId(first.id);
  }, [datasetId, datasetModalOpen, datasets]);

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

  const handleOpenAddToDataset = useCallback((): void => {
    setAddToDatasetError("");
    setDatasetModalOpen(true);
  }, []);

  const handleAddToDataset = useCallback(async (): Promise<void> => {
    if (!datasetId || selectedIds.length === 0) {
      return;
    }
    setAddToDatasetError("");
    try {
      await addTraces({datasetId, traceIds: selectedIds}).unwrap();
      setDatasetModalOpen(false);
      setSelectedIds([]);
    } catch {
      setAddToDatasetError("Could not add traces to the dataset.");
    }
  }, [addTraces, datasetId, selectedIds]);

  const handleRunTestMultiStage = useCallback(async (): Promise<void> => {
    setMultiStageError("");
    try {
      const result = await runTestMultiStage().unwrap();
      if (!result.traceId) {
        setMultiStageError("The workflow ran, but no local trace id was returned.");
        return;
      }
      router.push(`${prefix}/ai-trace-detail?id=${encodeURIComponent(result.traceId)}`);
    } catch (error) {
      const title =
        error && typeof error === "object" && "data" in error
          ? (error as {data?: {title?: string}}).data?.title
          : undefined;
      setMultiStageError(title ?? "Could not run the multi-stage trace test.");
    }
  }, [prefix, runTestMultiStage]);

  return (
    <AiObservabilityChrome {...props} screenName="ai-traces">
      <AiTracesListView
        addToDatasetError={addToDatasetError}
        datasetId={datasetId}
        datasetModalOpen={datasetModalOpen}
        datasetOptions={datasets.map((entry) => ({id: entry.id, name: entry.name}))}
        enqueueError={enqueueError || (isError ? "Failed to load traces." : undefined)}
        evaluatorId={evaluatorId}
        evaluators={evaluators}
        filters={filters}
        isAddingToDataset={addTracesState.isLoading}
        isEnqueueing={enqueueState.isLoading}
        isLoading={isLoading}
        isRunningMultiStage={testMultiStageState.isLoading}
        more={listed.more}
        multiStageError={multiStageError}
        onAddToDataset={handleAddToDataset}
        onClearSelection={handleClearSelection}
        onDatasetChange={setDatasetId}
        onDismissDatasetModal={() => {
          setDatasetModalOpen(false);
        }}
        onEnqueueReview={handleEnqueueReview}
        onEvaluatorChange={setEvaluatorId}
        onFiltersChange={handleFiltersChange}
        onOpenAddToDataset={handleOpenAddToDataset}
        onOpenTrace={handleOpenTrace}
        onPageChange={setPage}
        onRunTestMultiStage={handleRunTestMultiStage}
        onToggleSelect={handleToggleSelect}
        page={page}
        pageSize={listed.limit}
        selectedIds={selectedIds}
        showMultiStageTest={status?.localOn === true}
        total={listed.total}
        traces={listed.data}
      />
    </AiObservabilityChrome>
  );
};
