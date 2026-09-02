import {
  Badge,
  Box,
  Button,
  DataTable,
  type DataTableCellData,
  type DataTableColumn,
  Text,
} from "@terreno/ui";
import React, {useMemo} from "react";
import {
  EVALUATOR_TYPE_LABELS,
  type EvaluatorRecord,
  formatDimensionSummary,
  formatRunModeChips,
} from "./evaluatorTypes";

export interface AiEvaluatorsListViewProps {
  evaluators: EvaluatorRecord[];
  isLoading: boolean;
  loadError?: string;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onRetry: () => void;
}

const COLUMNS: DataTableColumn[] = [
  {columnType: "text", title: "Name", width: 200},
  {columnType: "evaluatorType", title: "Type", width: 120},
  {columnType: "text", title: "Dimensions", width: 200},
  {columnType: "text", title: "Target", width: 140},
  {columnType: "text", title: "Run modes", width: 220},
  {columnType: "evaluatorOpen", title: "", width: 88},
];

const typeBadgeStatus = (type: EvaluatorRecord["type"]): "info" | "neutral" | "warning" => {
  if (type === "human") {
    return "neutral";
  }
  if (type === "llm-judge") {
    return "info";
  }
  return "warning";
};

const TypeBadgeCell: React.FC<{cellData: DataTableCellData}> = ({cellData}) => (
  <Box justifyContent="center">
    <Badge
      status={typeBadgeStatus(String(cellData.value) as EvaluatorRecord["type"])}
      value={String(cellData.value ?? "")}
    />
  </Box>
);

export const AiEvaluatorsListView: React.FC<AiEvaluatorsListViewProps> = ({
  evaluators,
  isLoading,
  loadError,
  onCreate,
  onOpen,
  onRetry,
}) => {
  const customColumnComponentMap = useMemo(
    () => ({
      evaluatorOpen: ({cellData}: {cellData: DataTableCellData}) => (
        <Box justifyContent="center">
          <Button
            onClick={() => {
              onOpen(String(cellData.value ?? ""));
            }}
            size="sm"
            testID={`ai-evaluator-open-${String(cellData.value ?? "")}`}
            text="Open"
            variant="outline"
          />
        </Box>
      ),
      evaluatorType: TypeBadgeCell,
    }),
    [onOpen]
  );

  const rows: DataTableCellData[][] = useMemo(() => {
    return evaluators.map((evaluator) => {
      const chips = formatRunModeChips(evaluator.runModes);
      return [
        {value: evaluator.name},
        {value: EVALUATOR_TYPE_LABELS[evaluator.type]},
        {value: formatDimensionSummary(evaluator.dimensions)},
        {value: evaluator.target},
        {value: chips.length > 0 ? chips.join(" · ") : "—"},
        {value: evaluator.id},
      ];
    });
  }, [evaluators]);

  return (
    <Box gap={3} testID="ai-evaluators-list">
      <Box direction="row" gap={2} justifyContent="between" wrap>
        <Text color="secondaryDark" size="sm">
          Schema is checked on save. Live sampling bills judge calls at the configured rate.
        </Text>
        <Button onClick={onCreate} testID="ai-evaluators-create" text="Create evaluator" />
      </Box>
      {loadError ? (
        <Box gap={2} testID="ai-evaluators-load-error">
          <Text color="error">{loadError}</Text>
          <Button onClick={onRetry} text="Retry" variant="secondary" />
        </Box>
      ) : undefined}
      {isLoading ? (
        <Box padding={4} testID="ai-evaluators-loading">
          <Text>Loading evaluators…</Text>
        </Box>
      ) : evaluators.length === 0 ? (
        <Box padding={4} testID="ai-evaluators-empty">
          <Text color="secondaryDark">
            No evaluators yet. Create one to score traces and experiments.
          </Text>
        </Box>
      ) : (
        <DataTable
          columns={COLUMNS}
          customColumnComponentMap={customColumnComponentMap}
          data={rows}
          testID="ai-evaluators-table"
        />
      )}
    </Box>
  );
};
