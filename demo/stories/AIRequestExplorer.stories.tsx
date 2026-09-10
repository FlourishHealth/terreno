import {AIRequestExplorer, Box} from "@terreno/ui";
import {DateTime} from "luxon";
import type React from "react";
import {useCallback} from "react";

const rows = [
  {
    aiModel: "gpt-4.1",
    created: DateTime.fromISO("2026-09-10T12:00:00.000Z").toISO() ?? "",
    prompt: "Summarize the visit",
    requestType: "summarization",
    response: "Patient is stable.",
    responseTime: 820,
    tokensUsed: 140,
    user: {email: "clinician@example.com", name: "Alex"},
  },
];

export const AIRequestExplorerDemo: React.FC = (): React.ReactElement => {
  const onPageChange = useCallback((): void => {}, []);
  return (
    <Box>
      <AIRequestExplorer
        data={rows}
        onPageChange={onPageChange}
        page={1}
        totalCount={1}
        totalPages={1}
      />
    </Box>
  );
};

export const AIRequestExplorerLoading: React.FC = (): React.ReactElement => {
  const onPageChange = useCallback((): void => {}, []);
  return (
    <Box>
      <AIRequestExplorer
        data={[]}
        isLoading
        onPageChange={onPageChange}
        page={1}
        totalCount={0}
        totalPages={1}
      />
    </Box>
  );
};
