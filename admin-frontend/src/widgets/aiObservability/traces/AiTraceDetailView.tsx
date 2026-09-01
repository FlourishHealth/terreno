import {Accordion, Badge, Box, Button, Heading, Text} from "@terreno/ui";
import React, {useCallback, useMemo, useState} from "react";
import {
  durationBarPercent,
  type FlatSpan,
  flattenSpans,
  formatCost,
  formatLatency,
  formatTokens,
  promptCountLabel,
  stringifyIo,
  type TraceDetail,
  type TraceSpanNode,
} from "./traceTypes";

export interface AiTraceDetailViewProps {
  detail: TraceDetail;
  onBack: () => void;
}

const SpanRow: React.FC<{
  maxDuration: number;
  onSelect: (span: TraceSpanNode) => void;
  row: FlatSpan;
  selected: boolean;
}> = ({maxDuration, onSelect, row, selected}) => {
  const handleSelect = useCallback((): void => {
    onSelect(row.span);
  }, [onSelect, row.span]);
  const width = durationBarPercent(row.span.durationMs, maxDuration);
  return (
    <Box
      accessibilityHint="Show span detail"
      accessibilityLabel={row.span.name}
      color={selected ? "secondaryLight" : undefined}
      direction="row"
      gap={2}
      onClick={handleSelect}
      padding={2}
      testID={`ai-trace-span-${row.span.id}`}
    >
      <Box width={12 + row.depth * 16} />
      <Badge status="info" value={row.span.kind} />
      <Box flex="grow">
        <Text>{row.span.name}</Text>
      </Box>
      <Box flex="grow" height={8} rounding="full">
        <Box color="secondaryDark" height={8} rounding="full" width={`${width}%`} />
      </Box>
      <Text size="sm">{row.span.durationMs != null ? `${row.span.durationMs} ms` : "—"}</Text>
    </Box>
  );
};

export const AiTraceDetailView: React.FC<AiTraceDetailViewProps> = ({detail, onBack}) => {
  const flat = useMemo(() => flattenSpans(detail.spans), [detail.spans]);
  const maxDuration = useMemo(() => {
    return Math.max(1, ...flat.map((row) => row.span.durationMs ?? 0));
  }, [flat]);
  const [selectedId, setSelectedId] = useState(flat[0]?.span.id);
  const selected = useMemo(() => {
    return flat.find((row) => row.span.id === selectedId)?.span ?? flat[0]?.span;
  }, [flat, selectedId]);

  const handleSelect = useCallback((span: TraceSpanNode): void => {
    setSelectedId(span.id);
  }, []);

  const ioCollapsed = Boolean(detail.sensitive || selected?.sensitive);

  return (
    <Box gap={3} testID="ai-trace-detail">
      <Box direction="row" gap={2} justifyContent="between" wrap>
        <Box gap={1}>
          <Heading size="md">{detail.name}</Heading>
          <Box direction="row" gap={2} wrap>
            <Badge status={detail.status === "error" ? "error" : "success"} value={detail.status} />
            {detail.sensitive ? <Badge status="warning" value="sensitive" /> : undefined}
            <Text color="secondaryDark">{promptCountLabel(detail.prompts)}</Text>
            <Text color="secondaryDark">{formatTokens(detail.usage)}</Text>
            <Text color="secondaryDark">{formatCost(detail.usage)}</Text>
            <Text color="secondaryDark">{formatLatency(detail)}</Text>
          </Box>
          <Text color="secondaryDark" size="sm">
            {`id ${detail.id}${detail.userId ? ` · user ${detail.userId}` : ""}${
              detail.sessionId ? ` · session ${detail.sessionId}` : ""
            }`}
          </Text>
          {detail.errorSummary ? <Text color="error">{detail.errorSummary}</Text> : undefined}
        </Box>
        <Button onClick={onBack} text="Back to traces" variant="secondary" />
      </Box>
      <Box direction="row" gap={4} wrap>
        <Box flex="grow" gap={1} minWidth={240} testID="ai-trace-span-list">
          <Heading size="sm">Spans</Heading>
          {flat.map((row) => (
            <SpanRow
              key={row.span.id}
              maxDuration={maxDuration}
              onSelect={handleSelect}
              row={row}
              selected={row.span.id === selected?.id}
            />
          ))}
        </Box>
        <Box flex="grow" gap={2} minWidth={280} testID="ai-trace-span-detail">
          <Heading size="sm">Span detail</Heading>
          {selected ? (
            <>
              <Text>{`${selected.kind} · ${selected.name}`}</Text>
              <Text color="secondaryDark" size="sm">
                {`${formatTokens(selected.usage)} · ${formatCost(selected.usage)} · ${
                  selected.durationMs != null ? `${selected.durationMs} ms` : "—"
                }${selected.usage?.model ? ` · ${selected.usage.model}` : ""}`}
              </Text>
              {selected.error ? <Text color="error">{selected.error}</Text> : undefined}
              {stringifyIo(selected.input) ? (
                <Accordion
                  isCollapsed={ioCollapsed}
                  testID="ai-trace-span-input"
                  title={ioCollapsed ? "Input (sensitive)" : "Input"}
                >
                  <Text size="sm">{stringifyIo(selected.input)}</Text>
                </Accordion>
              ) : undefined}
              {stringifyIo(selected.output) ? (
                <Accordion
                  isCollapsed={ioCollapsed}
                  testID="ai-trace-span-output"
                  title={ioCollapsed ? "Output (sensitive)" : "Output"}
                >
                  <Text size="sm">{stringifyIo(selected.output)}</Text>
                </Accordion>
              ) : undefined}
            </>
          ) : (
            <Text color="secondaryDark">Select a span.</Text>
          )}
        </Box>
      </Box>
      <Box gap={2} testID="ai-trace-scores">
        <Heading size="sm">Scores</Heading>
        {detail.scores.length === 0 ? (
          <Text color="secondaryDark">No scores on this trace.</Text>
        ) : (
          detail.scores.map((score) => (
            <Box direction="row" gap={2} key={`${score.name}-${score.source}`} wrap>
              <Text bold>{score.name}</Text>
              <Text>{String(score.value)}</Text>
              <Text color="secondaryDark">{score.source}</Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};
