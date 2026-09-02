import {router} from "expo-router";
import React, {useCallback, useMemo} from "react";
import type {AdminScreenWidgetProps} from "../../../types";
import {AiObservabilityChrome} from "../shell/AiObservabilityChrome";
import {AiEvaluatorsListView} from "./AiEvaluatorsListView";
import {unwrapEvaluatorList} from "./evaluatorTypes";
import {useAiObservabilityEvaluatorsApi} from "./useAiObservabilityEvaluatorsApi";

export const AiEvaluatorsScreenWidget: React.FC<AdminScreenWidgetProps> = (props) => {
  const {api, routeBase} = props;
  const {useListQuery} = useAiObservabilityEvaluatorsApi(api);
  const {data, isError, isLoading, refetch} = useListQuery();
  const evaluators = useMemo(() => unwrapEvaluatorList(data), [data]);
  const prefix = (routeBase ?? "").replace(/\/$/, "");

  const handleOpen = useCallback(
    (id: string): void => {
      router.push(`${prefix}/ai-evaluator-detail?id=${encodeURIComponent(id)}`);
    },
    [prefix]
  );

  const handleCreate = useCallback((): void => {
    router.push(`${prefix}/ai-evaluator-new`);
  }, [prefix]);

  const loadError = isError ? "Failed to load evaluators." : undefined;

  return (
    <AiObservabilityChrome {...props} screenName="ai-evaluators">
      <AiEvaluatorsListView
        evaluators={evaluators}
        isLoading={isLoading}
        loadError={loadError}
        onCreate={handleCreate}
        onOpen={handleOpen}
        onRetry={refetch}
      />
    </AiObservabilityChrome>
  );
};
