import {Box, Spinner, Text} from "@terreno/ui";
import {router, useLocalSearchParams} from "expo-router";
import React, {useCallback, useMemo} from "react";
import type {AdminScreenWidgetProps} from "../../../types";
import {AiObservabilityChrome} from "../shell/AiObservabilityChrome";
import {AiDatasetDetailView} from "./AiDatasetDetailView";
import {unwrapDatasetItems, unwrapDatasetRecord} from "./datasetTypes";
import {useAiObservabilityDatasetsApi} from "./useAiObservabilityDatasetsApi";

export const AiDatasetDetailScreenWidget: React.FC<AdminScreenWidgetProps> = (props) => {
  const {api, routeBase} = props;
  const params = useLocalSearchParams<{id?: string | string[]}>();
  const idParam = params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const {useCreateItemMutation, useDetailQuery, useItemsQuery} = useAiObservabilityDatasetsApi(api);
  const {data, isError, isLoading} = useDetailQuery(id ?? "", {skip: !id});
  const {data: itemsRaw, refetch: refetchItems} = useItemsQuery(id ?? "", {skip: !id});
  const [createItem] = useCreateItemMutation();
  const dataset = useMemo(() => unwrapDatasetRecord(data), [data]);
  const items = useMemo(() => unwrapDatasetItems(itemsRaw), [itemsRaw]);
  const prefix = (routeBase ?? "").replace(/\/$/, "");
  const backHref = `${prefix}/ai-datasets`;

  const handleOpenExperiment = useCallback((): void => {
    router.push(`${prefix}/ai-experiment-new?datasetId=${encodeURIComponent(id ?? "")}`);
  }, [id, prefix]);

  const handleOpenTrace = useCallback(
    (traceId: string): void => {
      router.push(`${prefix}/ai-trace-detail?id=${encodeURIComponent(traceId)}`);
    },
    [prefix]
  );

  const handleAddItem = useCallback(
    async ({expectedOutput, input}: {expectedOutput: string; input: string}): Promise<void> => {
      if (!id) {
        return;
      }
      await createItem({
        body: {
          expectedOutput: JSON.parse(expectedOutput) as unknown,
          input: JSON.parse(input) as unknown,
          origin: "manual",
          proofread: true,
        },
        datasetId: id,
      }).unwrap();
      refetchItems();
    },
    [createItem, id, refetchItems]
  );

  if (!id) {
    return (
      <AiObservabilityChrome {...props} backHref={backHref} screenName="ai-dataset-detail">
        <Box padding={4}>
          <Text>Missing dataset id.</Text>
        </Box>
      </AiObservabilityChrome>
    );
  }

  if (isLoading) {
    return (
      <AiObservabilityChrome {...props} backHref={backHref} screenName="ai-dataset-detail">
        <Box alignItems="center" padding={4} testID="ai-dataset-detail-loading">
          <Spinner />
        </Box>
      </AiObservabilityChrome>
    );
  }

  if (isError || !dataset) {
    return (
      <AiObservabilityChrome {...props} backHref={backHref} screenName="ai-dataset-detail">
        <Box padding={4}>
          <Text color="error">Failed to load dataset.</Text>
        </Box>
      </AiObservabilityChrome>
    );
  }

  return (
    <AiObservabilityChrome {...props} backHref={backHref} screenName="ai-dataset-detail">
      <AiDatasetDetailView
        dataset={dataset}
        items={items}
        onAddItem={handleAddItem}
        onOpenExperiment={handleOpenExperiment}
        onOpenTrace={handleOpenTrace}
        routeBase={prefix}
      />
    </AiObservabilityChrome>
  );
};
