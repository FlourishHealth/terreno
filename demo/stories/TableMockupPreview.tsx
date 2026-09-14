import {Box, Text} from "@terreno/ui";
import type React from "react";

// Static, non-interactive stand-in for the Table/DataTable card previews shown on the demo home
// page. Both components position content absolutely within nested scroll containers, which
// escapes the small, overflow-hidden preview card and renders on top of the whole page. Render
// this lightweight mockup instead so neither card preview ever mounts a real Table/DataTable.
export const TableMockupPreview = (): React.ReactElement => {
  const rows = ["Row 1", "Row 2", "Row 3"];
  return (
    <Box border="default" direction="column" rounding="md" width="100%">
      <Box borderBottom="default" direction="row" padding={2}>
        <Box width={90}>
          <Text bold size="sm">
            Column 1
          </Text>
        </Box>
        <Box width={90}>
          <Text bold size="sm">
            Column 2
          </Text>
        </Box>
      </Box>
      {rows.map((row) => (
        <Box borderBottom="default" direction="row" key={row} padding={2}>
          <Box width={90}>
            <Text size="sm">{row}</Text>
          </Box>
          <Box width={90}>
            <Text size="sm">Data</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
