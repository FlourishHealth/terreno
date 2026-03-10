import {Box, Card, Heading, Spinner, Text} from "@terreno/ui";
import React, {useEffect, useState} from "react";

import {useLangfuseContext} from "../LangfuseProvider";

interface DashboardStats {
  promptCount: number;
  traceCount: number;
}

export const DashboardPage: React.FC = () => {
  const {apiBaseUrl} = useLangfuseContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`${apiBaseUrl}/prompts?limit=1`, {credentials: "include"}).then((r) =>
        r.json()
      ) as Promise<{meta: {total: number}}>,
      fetch(`${apiBaseUrl}/traces?limit=1`, {credentials: "include"}).then((r) =>
        r.json()
      ) as Promise<{meta: {total: number}}>,
    ])
      .then(([prompts, traces]) => {
        if (!cancelled) {
          setStats({
            promptCount: prompts.meta?.total ?? 0,
            traceCount: traces.meta?.total ?? 0,
          });
          setIsLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

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
      <Heading size="lg">Langfuse Dashboard</Heading>

      <Box direction="row" gap={3} wrap>
        <StatCard label="Prompts" value={stats?.promptCount ?? 0} />
        <StatCard label="Traces" value={stats?.traceCount ?? 0} />
      </Box>
    </Box>
  );
};

const StatCard: React.FC<{label: string; value: number}> = ({label, value}) => {
  return (
    <Card padding={4}>
      <Box alignItems="center" gap={1}>
        <Heading size="xl">{value}</Heading>
        <Text color="secondaryDark">{label}</Text>
      </Box>
    </Card>
  );
};
