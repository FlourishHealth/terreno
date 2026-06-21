import {
  Badge,
  Box,
  Button,
  Card,
  Heading,
  Icon,
  Page,
  SegmentedControl,
  Spinner,
  Text,
} from "@terreno/ui";
import React, {useCallback, useMemo, useState} from "react";
import {AdminScriptRunModal} from "./AdminScriptRunModal";
import {
  formatDuration,
  latestRunByScript,
  relativeTime,
  shortId,
  statusMeta,
  summarizeOutput,
} from "./scriptRunUtils";
import {type AdminApi, type AdminScriptConfig, resolveAdminBases, type ScriptRun} from "./types";
import {useAdminConfig} from "./useAdminConfig";
import {useAdminScripts} from "./useAdminScripts";

interface AdminScriptListProps {
  /** @deprecated Use `apiBase`/`routeBase`. Kept as a backward-compatible alias. */
  baseUrl?: string;
  /** Base path where admin API requests are sent. Falls back to `baseUrl`. */
  apiBase?: string;
  /** Base path used for in-app navigation. Falls back to `baseUrl`. */
  routeBase?: string;
  api: AdminApi;
  /** When false, the Run button is disabled. Defaults to true. */
  isAdmin?: boolean;
}

const HISTORY_PAGE_SIZE = 25;

type Tab = "scripts" | "history";

interface SelectedRun {
  description?: string;
  scriptName: string;
  taskId: string;
}

export const AdminScriptList: React.FC<AdminScriptListProps> = ({
  baseUrl,
  apiBase,
  routeBase,
  api,
  isAdmin = true,
}) => {
  const {apiBase: resolvedApiBase, routeBase: resolvedRouteBase} = resolveAdminBases({
    apiBase,
    baseUrl,
    routeBase,
  });
  const {config, isLoading, error} = useAdminConfig(api, resolvedApiBase);
  const {useListScriptRunsQuery} = useAdminScripts(api, resolvedApiBase);

  const [tab, setTab] = useState<Tab>("scripts");
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE);
  const [selectedScript, setSelectedScript] = useState<AdminScriptConfig | null>(null);
  const [selectedRun, setSelectedRun] = useState<SelectedRun | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const {data: runsData} = useListScriptRunsQuery({limit: historyLimit, page: 1});
  const runs: ScriptRun[] = useMemo(() => runsData?.data ?? [], [runsData]);
  const lastRuns = useMemo(() => latestRunByScript(runs), [runs]);

  const handleRunScript = useCallback((script: AdminScriptConfig) => {
    setSelectedRun(null);
    setSelectedScript(script);
    setModalVisible(true);
  }, []);

  const handleOpenRun = useCallback((run: ScriptRun, description?: string) => {
    setSelectedScript(null);
    setSelectedRun({description, scriptName: run.taskType, taskId: run._id});
    setModalVisible(true);
  }, []);

  const handleViewHistory = useCallback(() => {
    setTab("history");
  }, []);

  const handleDismiss = useCallback(() => {
    setModalVisible(false);
    setSelectedScript(null);
    setSelectedRun(null);
  }, []);

  const handleTabChange = useCallback((index: number) => {
    setTab(index === 1 ? "history" : "scripts");
  }, []);

  if (isLoading) {
    return (
      <Page color="transparent" maxWidth="100%" padding={0} title="Scripts">
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  if (error || !config) {
    return (
      <Page color="transparent" maxWidth="100%" padding={0} title="Scripts">
        <Box padding={4}>
          <Text color="error">Failed to load admin configuration.</Text>
        </Box>
      </Page>
    );
  }

  const scripts = config.scripts ?? [];

  if (scripts.length === 0) {
    return (
      <Page color="transparent" maxWidth="100%" padding={0} title="Scripts">
        <Box alignItems="center" padding={6}>
          <Text color="secondaryDark">No scripts registered.</Text>
        </Box>
      </Page>
    );
  }

  const descriptionFor = (name: string): string | undefined =>
    scripts.find((s) => s.name === name)?.description;

  const renderLastRun = (script: AdminScriptConfig): React.ReactElement | null => {
    const run = lastRuns[script.name];
    if (!run) {
      return null;
    }
    const meta = statusMeta(run.status);
    const iconColor =
      meta.badgeStatus === "success" ||
      meta.badgeStatus === "error" ||
      meta.badgeStatus === "warning"
        ? meta.badgeStatus
        : "secondaryDark";
    return (
      <Box alignItems="center" direction="row" gap={2} marginTop={1} wrap>
        <Icon color={iconColor} iconName={meta.iconName} size="sm" />
        <Text color="secondaryDark" size="sm">
          Last run {relativeTime(run.created)} — {run.isDryRun ? "dry run" : "live run"}{" "}
          {meta.label.toLowerCase()}
        </Text>
        <Box
          accessibilityHint="Opens the run history tab"
          accessibilityLabel="View run history"
          onClick={handleViewHistory}
        >
          <Text color="link" size="sm">
            History
          </Text>
        </Box>
      </Box>
    );
  };

  const renderScripts = (): React.ReactElement => (
    <Box gap={3} padding={4}>
      {scripts.map((script: AdminScriptConfig) => (
        <Card key={script.name} padding={4} testID={`admin-script-card-${script.name}`}>
          <Box alignItems="center" direction="row" gap={4} justifyContent="between">
            <Box flex="grow" gap={1}>
              <Heading size="sm">{script.name}</Heading>
              <Text color="secondaryDark" size="sm">
                {script.description}
              </Text>
              {renderLastRun(script)}
            </Box>
            <Button
              disabled={!isAdmin}
              iconName="play"
              onClick={() => handleRunScript(script)}
              testID={`admin-script-run-${script.name}`}
              text="Run"
              tooltipText={!isAdmin ? "Only admins can run scripts" : undefined}
              variant="primary"
            />
          </Box>
        </Card>
      ))}
      <Box alignItems="center" direction="row" gap={2} justifyContent="center" paddingY={2}>
        <Icon color="secondaryDark" iconName="circle-info" size="sm" />
        <Text color="secondaryDark" size="sm">
          Each Run opens the runner. Start with a dry run to preview changes before running live.
        </Text>
      </Box>
    </Box>
  );

  const renderRunRow = (run: ScriptRun): React.ReactElement => {
    const meta = statusMeta(run.status);
    const summary = summarizeOutput(run);
    const duration = formatDuration(run.startedAt, run.completedAt);
    return (
      <Box
        accessibilityHint="Opens this run's output"
        accessibilityLabel={`Open run ${run.taskType}`}
        alignItems="center"
        border="default"
        direction="row"
        gap={3}
        key={run._id}
        onClick={() => handleOpenRun(run, descriptionFor(run.taskType))}
        padding={3}
        rounding="md"
        wrap
      >
        <Box flex="grow" gap={1} minWidth={180}>
          <Box alignItems="baseline" direction="row" gap={2} wrap>
            <Text bold>{run.taskType}</Text>
            <Text color="secondaryDark" size="sm">
              #{shortId(run._id)}
            </Text>
          </Box>
          <Text color="secondaryDark" size="sm">
            {summary.total} line{summary.total === 1 ? "" : "s"}
            {summary.errorCount > 0
              ? ` · ${summary.errorCount} error${summary.errorCount === 1 ? "" : "s"}`
              : ""}
            {duration ? ` · ${duration}` : ""}
          </Text>
        </Box>
        <Box gap={1} minWidth={110}>
          <Text size="sm">{relativeTime(run.created)}</Text>
          {run.createdByName ? (
            <Text color="secondaryDark" size="sm">
              {run.createdByName}
            </Text>
          ) : null}
        </Box>
        <Badge status={run.isDryRun ? "info" : "warning"} value={run.isDryRun ? "DRY" : "LIVE"} />
        <Badge
          iconName={meta.iconName}
          secondary
          status={meta.badgeStatus === "neutral" ? "info" : meta.badgeStatus}
          value={meta.label}
        />
        <Button
          iconName="arrow-right"
          onClick={() => handleOpenRun(run, descriptionFor(run.taskType))}
          text="Open"
          variant="outline"
        />
      </Box>
    );
  };

  const renderHistory = (): React.ReactElement => (
    <Box gap={3} padding={4}>
      <Box gap={1}>
        <Heading size="sm">Run history</Heading>
        <Text color="secondaryDark" size="sm">
          Every dry and live run is logged. Open a run to review its output.
        </Text>
      </Box>
      {runs.length === 0 ? (
        <Box alignItems="center" padding={6}>
          <Text color="secondaryDark">No runs logged yet.</Text>
        </Box>
      ) : (
        <Box gap={2}>
          {runs.map((run) => renderRunRow(run))}
          {runsData?.more && (
            <Box alignItems="center" paddingY={2}>
              <Button
                onClick={() => setHistoryLimit((limit) => limit + HISTORY_PAGE_SIZE)}
                text="Load more"
                variant="muted"
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );

  return (
    <Page color="transparent" maxWidth="100%" padding={0} scroll title="Scripts">
      <Box paddingX={4} paddingY={4}>
        <SegmentedControl
          items={[
            "Scripts",
            runs.length > 0 ? `Run history (${runsData?.total ?? runs.length})` : "Run history",
          ]}
          onChange={handleTabChange}
          selectedIndex={tab === "history" ? 1 : 0}
        />
      </Box>

      {tab === "scripts" ? renderScripts() : renderHistory()}

      <AdminScriptRunModal
        api={api}
        apiBase={resolvedApiBase}
        historyTaskId={selectedRun?.taskId}
        onDismiss={handleDismiss}
        routeBase={resolvedRouteBase}
        scriptDescription={selectedRun?.description ?? selectedScript?.description}
        scriptName={selectedRun?.scriptName ?? selectedScript?.name ?? null}
        visible={modalVisible}
      />
    </Page>
  );
};
