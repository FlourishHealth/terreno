import {Box, Heading, Text} from "@terreno/ui";
import {DateTime} from "luxon";
import React from "react";

import type {TraceListItem} from "../../backend/types";

interface TraceViewerProps {
  trace: TraceListItem;
}

export const TraceViewer: React.FC<TraceViewerProps> = ({trace}) => {
  const timestamp = DateTime.fromISO(trace.timestamp).toLocaleString(DateTime.DATETIME_FULL);

  return (
    <Box gap={3}>
      <Heading size="md">{trace.name}</Heading>

      <Box direction="row" gap={4} wrap>
        <Box gap={1}>
          <Text bold size="sm">
            ID
          </Text>
          <Text size="sm">{trace.id}</Text>
        </Box>
        <Box gap={1}>
          <Text bold size="sm">
            Timestamp
          </Text>
          <Text size="sm">{timestamp}</Text>
        </Box>
        {trace.userId && (
          <Box gap={1}>
            <Text bold size="sm">
              User
            </Text>
            <Text size="sm">{trace.userId}</Text>
          </Box>
        )}
        {trace.sessionId && (
          <Box gap={1}>
            <Text bold size="sm">
              Session
            </Text>
            <Text size="sm">{trace.sessionId}</Text>
          </Box>
        )}
      </Box>

      {trace.input !== undefined && (
        <Box gap={1}>
          <Text bold>Input</Text>
          <Box color="disabled" padding={3} rounding="md">
            <Text size="sm">{JSON.stringify(trace.input, null, 2)}</Text>
          </Box>
        </Box>
      )}

      {trace.output !== undefined && (
        <Box gap={1}>
          <Text bold>Output</Text>
          <Box color="disabled" padding={3} rounding="md">
            <Text size="sm">{JSON.stringify(trace.output, null, 2)}</Text>
          </Box>
        </Box>
      )}

      {trace.metadata && Object.keys(trace.metadata).length > 0 && (
        <Box gap={1}>
          <Text bold>Metadata</Text>
          <Box color="disabled" padding={3} rounding="md">
            <Text size="sm">{JSON.stringify(trace.metadata, null, 2)}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
