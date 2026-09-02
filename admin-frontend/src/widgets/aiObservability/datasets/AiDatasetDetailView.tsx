import {
  Badge,
  Box,
  Button,
  DataTable,
  type DataTableCellData,
  type DataTableColumn,
  Modal,
  SegmentedControl,
  Text,
  TextArea,
} from "@terreno/ui";
import React, {useMemo, useState} from "react";
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
  onAddItem: (body: {expectedOutput: string; input: string}) => void;
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

const COLUMNS: DataTableColumn[] = [
  {columnType: "text", title: "Input", width: 200},
  {columnType: "text", title: "Expected", width: 200},
  {columnType: "text", title: "Provenance", width: 180},
  {columnType: "traceOpen", title: "Trace", width: 120},
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
  const [inputText, setInputText] = useState("{}");
  const [expectedText, setExpectedText] = useState("{}");

  const filtered = useMemo(() => {
    return filterDatasetItemsByTab(items, tab);
  }, [items, tab]);

  const needsReviewCount = dataset.counts.needsReview;
  const customColumnComponentMap = useMemo(
    () => ({
      traceOpen: ({cellData}: {cellData: DataTableCellData}) => {
        const traceId = String(cellData.value ?? "");
        if (!traceId || !onOpenTrace) {
          return <Text>—</Text>;
        }
        return (
          <Button
            onClick={() => {
              onOpenTrace(traceId);
            }}
            size="sm"
            text="Open trace"
            variant="ghost"
          />
        );
      },
    }),
    [onOpenTrace]
  );

  const rows: DataTableCellData[][] = useMemo(() => {
    return filtered.map((item) => {
      const attribution = item.annotatedBy?.label ?? (item.proofread ? "Human" : "Needs review");
      return [
        {value: summarizeJson(item.input)},
        {value: summarizeJson(item.expectedOutput)},
        {value: `${item.origin} · ${attribution}`},
        {value: item.sourceTraceId ?? ""},
      ];
    });
  }, [filtered]);

  const selectedIndex = TAB_OPTIONS.indexOf(tab);

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
        <DataTable
          columns={COLUMNS}
          customColumnComponentMap={customColumnComponentMap}
          data={rows}
          testID="ai-dataset-items-table"
        />
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
          <Button
            onClick={() => {
              onAddItem({expectedOutput: expectedText, input: inputText});
              setAddOpen(false);
            }}
            text="Add item"
          />
        </Box>
      </Modal>
    </Box>
  );
};
