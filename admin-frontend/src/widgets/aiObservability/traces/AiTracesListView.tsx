import {
  Badge,
  Box,
  Button,
  CheckBox,
  DataTable,
  type DataTableCellData,
  type DataTableColumn,
  DateTimeField,
  SelectField,
  Spinner,
  Text,
  TextField,
} from "@terreno/ui";
import React, {useCallback, useMemo} from "react";
import {
  type EvaluatorOption,
  formatCost,
  formatLatency,
  formatTokens,
  promptCountLabel,
  selectedSensitiveCount,
  type TraceListFilters,
  type TraceListItem,
} from "./traceTypes";

const COLUMNS: DataTableColumn[] = [
  {columnType: "traceSelect", title: "", width: 44},
  {columnType: "traceStatus", title: "Status", width: 72},
  {columnType: "text", title: "Name", width: 180},
  {columnType: "traceSensitive", title: "Sensitive", width: 100},
  {columnType: "text", title: "Error", width: 180},
  {columnType: "text", title: "Prompts", width: 90},
  {columnType: "text", title: "Spans", width: 72},
  {columnType: "text", title: "Tokens", width: 80},
  {columnType: "text", title: "Cost", width: 90},
  {columnType: "text", title: "Latency", width: 90},
  {columnType: "text", title: "Scores", width: 80},
  {columnType: "traceOpen", title: "", width: 88},
];

const statusOptions = [
  {label: "All statuses", value: ""},
  {label: "ok", value: "ok"},
  {label: "error", value: "error"},
];

export interface AiTracesListViewProps {
  enqueueError?: string;
  evaluatorId: string;
  evaluators: EvaluatorOption[];
  filters: TraceListFilters;
  isEnqueueing?: boolean;
  isLoading?: boolean;
  more?: boolean;
  onClearSelection: () => void;
  onEnqueueReview: () => void;
  onEvaluatorChange: (id: string) => void;
  onFiltersChange: (filters: TraceListFilters) => void;
  onOpenTrace: (id: string) => void;
  onPageChange: (page: number) => void;
  onToggleSelect: (id: string) => void;
  page: number;
  pageSize?: number;
  selectedIds: string[];
  total: number;
  traces: TraceListItem[];
}

const StatusDot: React.FC<{cellData: DataTableCellData}> = ({cellData}) => (
  <Box alignItems="center" justifyContent="center">
    <Badge
      status={cellData.value === "error" ? "error" : "success"}
      testID={`ai-traces-status-${String(cellData.value)}`}
      variant="status"
    />
  </Box>
);

export const AiTracesListView: React.FC<AiTracesListViewProps> = ({
  enqueueError,
  evaluatorId,
  evaluators,
  filters,
  isEnqueueing,
  isLoading,
  more,
  onClearSelection,
  onEnqueueReview,
  onEvaluatorChange,
  onFiltersChange,
  onOpenTrace,
  onPageChange,
  onToggleSelect,
  page,
  pageSize = 20,
  selectedIds,
  total,
  traces,
}) => {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const sensitiveCount = useMemo(() => {
    return selectedSensitiveCount(traces, selectedIds);
  }, [selectedIds, traces]);

  const customColumnComponentMap = useMemo(
    () => ({
      traceOpen: ({cellData}: {cellData: DataTableCellData}) => (
        <Box justifyContent="center">
          <Button
            onClick={() => {
              onOpenTrace(String(cellData.value ?? ""));
            }}
            size="sm"
            testID={`ai-traces-open-${String(cellData.value ?? "")}`}
            text="Open"
            variant="outline"
          />
        </Box>
      ),
      traceSelect: ({cellData}: {cellData: DataTableCellData}) => {
        const id = String(cellData.value ?? "");
        return (
          <Box
            accessibilityHint="Toggle row selection"
            accessibilityLabel={`Select trace ${id}`}
            justifyContent="center"
            onClick={() => {
              onToggleSelect(id);
            }}
            testID={`ai-traces-select-${id}`}
          >
            <CheckBox selected={selected.has(id)} />
          </Box>
        );
      },
      traceSensitive: ({cellData}: {cellData: DataTableCellData}) =>
        cellData.value ? (
          <Box justifyContent="center">
            <Badge status="warning" testID="ai-traces-sensitive-badge" value="sensitive" />
          </Box>
        ) : (
          <Text color="secondaryDark">—</Text>
        ),
      traceStatus: StatusDot,
    }),
    [onOpenTrace, onToggleSelect, selected]
  );

  const rows: DataTableCellData[][] = useMemo(() => {
    return traces.map((trace) => [
      {value: trace.id},
      {value: trace.status},
      {value: trace.name},
      {value: trace.sensitive},
      {value: trace.errorSummary ?? "—"},
      {value: promptCountLabel(trace.prompts)},
      {value: String(trace.spanCount)},
      {value: formatTokens(trace.usage)},
      {value: formatCost(trace.usage)},
      {value: formatLatency(trace)},
      {value: String(trace.scoreCount)},
      {value: trace.id},
    ]);
  }, [traces]);

  const handleStatusChange = useCallback(
    (value: string): void => {
      onFiltersChange({...filters, status: value as TraceListFilters["status"]});
    },
    [filters, onFiltersChange]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  return (
    <Box gap={3} testID="ai-traces-list">
      <Box gap={2} testID="ai-traces-filters">
        <Box direction="row" gap={2} testID="ai-traces-time-filters" wrap>
          <Box flex="grow" minWidth={320}>
            <DateTimeField
              onChange={(value) => {
                onFiltersChange({...filters, from: value});
              }}
              testID="ai-traces-filter-from"
              title="From"
              type="datetime"
              value={filters.from}
            />
          </Box>
          <Box flex="grow" minWidth={320}>
            <DateTimeField
              onChange={(value) => {
                onFiltersChange({...filters, to: value});
              }}
              testID="ai-traces-filter-to"
              title="To"
              type="datetime"
              value={filters.to}
            />
          </Box>
        </Box>
        <Box alignItems="end" direction="row" gap={2} testID="ai-traces-field-filters" wrap>
          <Box flex="grow" minWidth={160}>
            <SelectField
              onChange={handleStatusChange}
              options={statusOptions}
              testID="ai-traces-filter-status"
              title="Status"
              value={filters.status}
            />
          </Box>
          <Box flex="grow" minWidth={180}>
            <TextField
              onChange={(value) => {
                onFiltersChange({...filters, prompt: value});
              }}
              testID="ai-traces-filter-prompt"
              title="Prompt"
              value={filters.prompt}
            />
          </Box>
          <Box flex="grow" minWidth={160}>
            <TextField
              onChange={(value) => {
                onFiltersChange({...filters, userId: value});
              }}
              testID="ai-traces-filter-user"
              title="User"
              value={filters.userId}
            />
          </Box>
          <Box flex="grow" minWidth={160}>
            <TextField
              onChange={(value) => {
                onFiltersChange({...filters, sessionId: value});
              }}
              testID="ai-traces-filter-session"
              title="Session"
              value={filters.sessionId}
            />
          </Box>
          <Button
            onClick={() => {
              onFiltersChange({
                ...filters,
                hasScore: filters.hasScore === true ? undefined : true,
              });
            }}
            testID="ai-traces-filter-has-score"
            text={filters.hasScore ? "Has score: on" : "Has score"}
            variant={filters.hasScore ? "primary" : "secondary"}
          />
          <Button
            onClick={() => {
              onFiltersChange({
                ...filters,
                sensitive: filters.sensitive === true ? undefined : true,
              });
            }}
            testID="ai-traces-filter-sensitive"
            text={filters.sensitive ? "Sensitive: on" : "Sensitive"}
            variant={filters.sensitive ? "primary" : "secondary"}
          />
        </Box>
      </Box>
      {selectedIds.length > 0 ? (
        <Box
          color="secondaryLight"
          direction="row"
          gap={2}
          padding={3}
          testID="ai-traces-bulk-bar"
          wrap
        >
          <Text>{`${selectedIds.length} selected`}</Text>
          {sensitiveCount > 0 ? (
            <Text color="warning" testID="ai-traces-sensitive-warning">
              {`${sensitiveCount} selected ${sensitiveCount === 1 ? "trace is" : "traces are"} marked sensitive.`}
            </Text>
          ) : undefined}
          <SelectField
            onChange={onEvaluatorChange}
            options={
              evaluators.length > 0
                ? evaluators.map((entry) => ({label: entry.name, value: entry.id}))
                : [{label: "No human evaluator installed", value: ""}]
            }
            testID="ai-traces-evaluator"
            title="Evaluator"
            value={evaluatorId}
          />
          <Button
            disabled={isEnqueueing || !evaluatorId || selectedIds.length === 0}
            onClick={onEnqueueReview}
            testID="ai-traces-send-review"
            text="Send to review queue"
          />
          <Button
            disabled
            onClick={async () => undefined}
            testID="ai-traces-add-dataset"
            text="Add to dataset"
            variant="secondary"
          />
          <Button
            onClick={onClearSelection}
            testID="ai-traces-clear-selection"
            text="Clear"
            variant="ghost"
          />
        </Box>
      ) : undefined}
      {enqueueError ? <Text color="error">{enqueueError}</Text> : undefined}
      {isLoading ? (
        <Box alignItems="center" padding={6} testID="ai-traces-loading">
          <Spinner />
        </Box>
      ) : traces.length === 0 ? (
        <Box padding={4} testID="ai-traces-empty">
          <Text color="secondaryDark">No traces match these filters.</Text>
        </Box>
      ) : (
        <DataTable
          columns={COLUMNS}
          customColumnComponentMap={customColumnComponentMap}
          data={rows}
          page={page}
          setPage={onPageChange}
          testID="ai-traces-table"
          totalPages={totalPages}
        />
      )}
      {!isLoading && traces.length > 0 ? (
        <Text color="secondaryDark" size="sm" testID="ai-traces-pagination">
          {`${total} traces${more ? " · more pages" : ""}`}
        </Text>
      ) : undefined}
    </Box>
  );
};
