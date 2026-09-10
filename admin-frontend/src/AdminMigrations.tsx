import {Banner, Box, Button, Card, Heading, Spinner, Text} from "@terreno/ui";
import {DateTime} from "luxon";
import React, {useCallback, useEffect, useState} from "react";
import {AdminScreenPage} from "./AdminScreenPage";
import type {AdminScreenProps, BackgroundTask} from "./types";
import {resolveAdminBases} from "./types";
import {useAdminConfig} from "./useAdminConfig";
import {useAdminMigrations} from "./useAdminMigrations";
import {useAdminScripts} from "./useAdminScripts";

const POLL_INTERVAL_MS = 1000;

const isTerminalStatus = (status?: string): boolean => {
  return status === "completed" || status === "failed" || status === "cancelled";
};

const formatAppliedAt = (value: string | undefined): string => {
  if (!value) {
    return "";
  }
  const parsed = DateTime.fromISO(value);
  if (!parsed.isValid) {
    return value;
  }
  return parsed.toUTC().toFormat("yyyy-LL-dd HH:mm:ss 'UTC'");
};

export const AdminMigrations: React.FC<AdminScreenProps> = ({api, apiBase, baseUrl, routeBase}) => {
  const {apiBase: resolvedApiBase, routeBase: resolvedRouteBase} = resolveAdminBases({
    apiBase,
    baseUrl,
    routeBase,
  });
  const {
    config,
    error: configError,
    isLoading: isConfigLoading,
  } = useAdminConfig(api, resolvedApiBase);
  const migrationsEnabled = Boolean(config?.migrations?.enabled);
  const {useGetMigrationsQuery, useRunMigrationsMutation} = useAdminMigrations(
    api,
    resolvedApiBase
  );
  const {useGetScriptTaskQuery} = useAdminScripts(api, resolvedApiBase);
  const {
    data: status,
    error: statusError,
    isLoading: isStatusLoading,
    refetch,
  } = useGetMigrationsQuery(undefined, {skip: !migrationsEnabled});
  const [runMigrations, {isLoading: isStarting}] = useRunMigrationsMutation();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [runKind, setRunKind] = useState<"dry" | "wet" | null>(null);

  const {data: taskPayload} = useGetScriptTaskQuery(taskId ?? "", {
    pollingInterval: taskId ? POLL_INTERVAL_MS : 0,
    skip: !taskId,
  });
  const task = taskPayload?.task as BackgroundTask | undefined;

  // Refresh status after a batch finishes so applied/pending lists match history.
  useEffect(() => {
    if (!task || !isTerminalStatus(task.status) || !refetch) {
      return;
    }
    void refetch();
  }, [refetch, task]);

  const handleRun = useCallback(
    async (wetRun: boolean): Promise<void> => {
      setRunKind(wetRun ? "wet" : "dry");
      const result = await runMigrations({wetRun}).unwrap();
      setTaskId(result.taskId);
    },
    [runMigrations]
  );

  const handleDryRun = useCallback((): void => {
    void handleRun(false);
  }, [handleRun]);

  const handleApply = useCallback((): void => {
    void handleRun(true);
  }, [handleRun]);

  if (isConfigLoading) {
    return (
      <Box
        alignItems="center"
        justifyContent="center"
        padding={6}
        testID="admin-migrations-loading"
      >
        <Spinner />
      </Box>
    );
  }

  if (configError || !config) {
    return (
      <Box padding={4} testID="admin-migrations-config-error">
        <Text color="error">Failed to load admin configuration.</Text>
      </Box>
    );
  }

  if (!migrationsEnabled) {
    return (
      <AdminScreenPage
        backHref={resolvedRouteBase}
        color="transparent"
        maxWidth="100%"
        padding={4}
        title="Migrations"
      >
        <Box testID="admin-migrations">
          <Text>Migrations are not configured on this server.</Text>
        </Box>
      </AdminScreenPage>
    );
  }

  const pending = status?.pending ?? [];
  const applied = status?.applied ?? [];
  const isBusy = isStarting || Boolean(taskId && task && !isTerminalStatus(task.status));

  return (
    <AdminScreenPage
      backHref={resolvedRouteBase}
      color="transparent"
      maxWidth="100%"
      padding={4}
      title="Migrations"
    >
      <Box gap={4} testID="admin-migrations">
        {isStatusLoading ? (
          <Spinner />
        ) : statusError ? (
          <Text color="error">Failed to load migration status.</Text>
        ) : (
          <>
            <Card padding={4} testID="admin-migrations-pending">
              <Heading size="sm">Pending</Heading>
              {pending.length === 0 ? (
                <Text color="secondaryDark">No pending migrations.</Text>
              ) : (
                pending.map((item) => <Text key={item.id}>{item.id}</Text>)
              )}
            </Card>
            <Card padding={4} testID="admin-migrations-applied">
              <Heading size="sm">Applied</Heading>
              {applied.length === 0 ? (
                <Text color="secondaryDark">None applied yet.</Text>
              ) : (
                applied.map((item) => (
                  <Text key={item.id}>
                    {item.id}
                    {item.appliedAt ? ` · ${formatAppliedAt(item.appliedAt)}` : ""}
                  </Text>
                ))
              )}
            </Card>
            {status?.lock ? (
              <Banner
                id="admin-migrations-lock"
                status="warning"
                text={`Lock held by ${status.lock.holder}`}
              />
            ) : null}
          </>
        )}
        <Box direction="row" gap={2} wrap>
          <Button
            disabled={isBusy}
            onClick={handleDryRun}
            testID="admin-migrations-dry-run"
            text="Dry run"
            variant="outline"
          />
          <Button
            disabled={isBusy || pending.length === 0}
            onClick={handleApply}
            testID="admin-migrations-apply"
            text="Apply pending"
            variant="primary"
          />
        </Box>
        {task ? (
          <Card padding={4} testID="admin-migrations-task">
            <Text>
              {runKind === "wet" ? "Apply" : "Dry run"} {task.status}
              {task.error ? `: ${task.error}` : ""}
            </Text>
          </Card>
        ) : null}
      </Box>
    </AdminScreenPage>
  );
};
