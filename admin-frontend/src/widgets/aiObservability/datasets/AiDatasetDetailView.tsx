import {Badge, Box, Button, Modal, SegmentedControl, Text, TextArea} from "@terreno/ui";
import React, {useCallback, useMemo, useState} from "react";
import {
  ObservabilityTable,
  type ObservabilityTableColumn,
  type ObservabilityTableRow,
} from "../shell/ObservabilityTable";
import {
  type DatasetItemRecord,
  type DatasetItemTab,
  type DatasetRecord,
  filterDatasetItemsByTab,
  summarizeJson,
} from "./datasetTypes";

export interface AiDatasetDetailViewProps {
  dataset: DatasetRecord;
  items: DatasetItemRecord[];
  onAddItem: (body: {expectedOutput: string; input: string}) => Promise<string | undefined>;
  onOpenExperiment: () => void;
  onOpenTrace?: (traceId: string) => void;
  routeBase: string;
}

const TAB_OPTIONS: DatasetItemTab[] = ["all", "human", "auto", "needsReview"];

const tabLabel = (tab: DatasetItemTab, needsReviewCount: number): string => {
  if (tab === "all") {
    return "All";
  }
  if (tab === "human") {
    return "Human";
  }
  if (tab === "auto") {
    return "Auto";
  }
  if (needsReviewCount > 0) {
    return `Needs review (${needsReviewCount})`;
  }
  return "Needs review";
};

const COLUMNS: ObservabilityTableColumn[] = [
  {minWidth: 200, title: "Input"},
  {minWidth: 200, title: "Expected"},
  {minWidth: 150, title: "Provenance"},
  {minWidth: 110, title: "Trace"},
];

export const AiDatasetDetailView: React.FC<AiDatasetDetailViewProps> = ({
  dataset,
  items,
  onAddItem,
  onOpenExperiment,
  onOpenTrace,
}) => {
  const [tab, setTab] = useState<DatasetItemTab>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [inputText, setInputText] = useState("{}");
  const [expectedText, setExpectedText] = useState("{}");

  const filtered = useMemo(() => {
    return filterDatasetItemsByTab(items, tab);
  }, [items, tab]);

  const needsReviewCount = dataset.counts.needsReview;

  const rows: ObservabilityTableRow[] = useMemo(() => {
    return filtered.map((item) => {
      const attribution = item.annotatedBy?.label ?? (item.proofread ? "Human" : "Needs review");
      const traceId = item.sourceTraceId;
      return {
        cells: [
          summarizeJson(item.input),
          summarizeJson(item.expectedOutput),
          `${item.origin} · ${attribution}`,
          traceId && onOpenTrace ? (
            <Button
              onClick={() => {
                onOpenTrace(traceId);
              }}
              size="sm"
              text="Open trace"
              variant="ghost"
            />
          ) : (
            "—"
          ),
        ],
        key: item.id,
      };
    });
  }, [filtered, onOpenTrace]);

  const selectedIndex = TAB_OPTIONS.indexOf(tab);
  const handleAddItem = useCallback(async (): Promise<void> => {
    setAddError("");
    setIsAdding(true);
    const error = await onAddItem({expectedOutput: expectedText, input: inputText});
    setIsAdding(false);
    if (error) {
      setAddError(error);
      return;
    }
    setAddOpen(false);
  }, [expectedText, inputText, onAddItem]);

  return (
    <Box gap={4} testID="ai-dataset-detail">
      <Box direction="row" gap={2} justifyContent="between" wrap>
        <Box gap={1}>
          <Text>
            {dataset.counts.human} human · {dataset.counts.auto} auto · {dataset.counts.total} total
          </Text>
          <Text color="secondaryDark" size="sm">
            Input schema binding: {dataset.inputSchemaPromptName ?? "none"}
          </Text>
        </Box>
        <Box direction="row" gap={2}>
          <Button
            onClick={() => {
              setAddError("");
              setAddOpen(true);
            }}
            testID="ai-dataset-add-item"
            text="Add item"
            variant="secondary"
          />
          <Button
            onClick={onOpenExperiment}
            testID="ai-dataset-run-experiment"
            text="Run experiment"
          />
        </Box>
      </Box>
      <SegmentedControl
        items={TAB_OPTIONS.map((option) => tabLabel(option, needsReviewCount))}
        onChange={(index) => {
          const next = TAB_OPTIONS[index];
          if (next) {
            setTab(next);
          }
        }}
        selectedIndex={selectedIndex}
        testID="ai-dataset-tabs"
      />
      {tab === "needsReview" && needsReviewCount > 0 ? (
        <Badge
          status="error"
          testID="ai-dataset-needs-review-count"
          value={`${needsReviewCount} need review`}
        />
      ) : undefined}
      {filtered.length === 0 ? (
        <Box padding={4} testID="ai-dataset-items-empty">
          <Text color="secondaryDark">No items in this tab.</Text>
        </Box>
      ) : (
        <ObservabilityTable columns={COLUMNS} rows={rows} testID="ai-dataset-items-table" />
      )}
      <Modal
        onDismiss={() => {
          setAddOpen(false);
        }}
        title="Add dataset item"
        visible={addOpen}
      >
        <Box gap={3} padding={3}>
          <TextArea onChange={setInputText} rows={4} title="Input (JSON)" value={inputText} />
          <TextArea
            onChange={setExpectedText}
            rows={4}
            title="Expected output (JSON)"
            value={expectedText}
          />
          <Button loading={isAdding} onClick={handleAddItem} text="Add item" />
          {addError ? (
            <Text color="error" testID="ai-dataset-add-item-error">
              {addError}
            </Text>
          ) : undefined}
        </Box>
      </Modal>
    </Box>
  );
};
