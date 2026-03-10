import {Box, Button, Card, Heading, Spinner, Text} from "@terreno/ui";
import {DateTime} from "luxon";
import React, {useState} from "react";
import type {TraceListItem} from "../../backend/types";
import {TraceViewer} from "../components/TraceViewer";
import {useTrace, useTraces} from "../hooks/useTrace";

export const TracesPage: React.FC = () => {
  const {traces, total, isLoading, error, page, setPage} = useTraces();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return (
      <Box gap={3} padding={4}>
        <Button onClick={() => setSelectedId(null)} text="← Back" variant="muted" />
        <TraceDetailView traceId={selectedId} />
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box alignItems="center" justifyContent="center" padding={8}>
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={4}>
        <Text color="error">{error}</Text>
      </Box>
    );
  }

  return (
    <Box gap={4} padding={4}>
      <Box alignItems="center" direction="row" justifyContent="between">
        <Heading size="lg">Traces</Heading>
        <Text color="secondaryDark">{total} total</Text>
      </Box>

      {traces.length === 0 ? (
        <Text color="secondaryDark">No traces found.</Text>
      ) : (
        <Box gap={2}>
          {traces.map((trace) => (
            <TraceRow key={trace.id} onSelect={() => setSelectedId(trace.id)} trace={trace} />
          ))}
        </Box>
      )}

      {total > 20 && (
        <Box direction="row" gap={2} justifyContent="center">
          <Button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            text="Previous"
            variant="muted"
          />
          <Text>Page {page}</Text>
          <Button
            disabled={traces.length < 20}
            onClick={() => setPage(page + 1)}
            text="Next"
            variant="muted"
          />
        </Box>
      )}
    </Box>
  );
};

const TraceRow: React.FC<{trace: TraceListItem; onSelect: () => void}> = ({trace, onSelect}) => {
  const timestamp = DateTime.fromISO(trace.timestamp).toRelative() ?? trace.timestamp;

  return (
    <Card padding={3}>
      <Box
        accessibilityHint="Opens trace detail view"
        accessibilityLabel={`View trace ${trace.name}`}
        alignItems="center"
        direction="row"
        justifyContent="between"
        onClick={onSelect}
      >
        <Box gap={1}>
          <Text bold>{trace.name}</Text>
          <Text color="secondaryDark" size="sm">
            {timestamp}
            {trace.userId ? ` · ${trace.userId}` : ""}
          </Text>
        </Box>
        <Text color="secondaryDark" size="sm">
          {trace.id.slice(0, 8)}…
        </Text>
      </Box>
    </Card>
  );
};

const TraceDetailView: React.FC<{traceId: string}> = ({traceId}) => {
  const {trace, isLoading, error} = useTrace(traceId);

  if (isLoading) {
    return (
      <Box alignItems="center" justifyContent="center" padding={8}>
        <Spinner />
      </Box>
    );
  }

  if (error || !trace) {
    return <Text color="error">{error ?? "Trace not found"}</Text>;
  }

  return <TraceViewer trace={trace} />;
};
