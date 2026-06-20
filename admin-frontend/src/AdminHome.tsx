import {Box, Button, Card, Heading, Page, printDateAndTime, Spinner, Text} from "@terreno/ui";
import type {Href} from "expo-router";
import {router} from "expo-router";
import React, {useCallback, useMemo} from "react";
import {AdminVersionConfig} from "./AdminVersionConfig";
import type {AdminApi, AdminFieldValue, AdminModelConfig} from "./types";
import {resolveAdminBases} from "./types";
import {useAdminApi} from "./useAdminApi";
import {useAdminConfig} from "./useAdminConfig";

const BUILTIN_WIDGET_IDS = new Set([
  "modelStats",
  "modelsGrid",
  "feature-flags-overrides",
  "versionConfig",
  "scriptRunner",
  "recentActivity",
]);

const normalizeWidgetIds = (ids: string[] | undefined): string[] => {
  if (!ids?.length) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const normalized = id === "modelStats" ? "modelsGrid" : id;
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
};

const normalizeSidebarWidgets = (ids: string[] | undefined): string[] => {
  const normalized = normalizeWidgetIds(ids);
  if (!normalized.length) {
    return normalized;
  }
  const tail = "recentActivity";
  const without = normalized.filter((id) => id !== tail);
  if (normalized.includes(tail)) {
    return [...without, tail];
  }
  return normalized;
};

const warnUnknownWidget = (widgetId: string): void => {
  if (BUILTIN_WIDGET_IDS.has(widgetId)) {
    return;
  }
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn(
      `[AdminHome] Unknown home widget id "${widgetId}". Register a built-in or remove it from admin config.`
    );
  }
};

interface AdminHomeProps {
  /** @deprecated Use `apiBase`/`routeBase`. */
  baseUrl?: string;
  apiBase?: string;
  routeBase?: string;
  api: AdminApi;
  /**
   * When true, omits the outer {@link Page} wrapper so the dashboard can sit under a parent
   * screen (for example, the Expo admin index together with tools and model cards).
   */
  embedded?: boolean;
}

const ModelGridCard: React.FC<{
  api: AdminApi;
  model: AdminModelConfig;
  routeBase: string;
}> = ({api, model, routeBase}) => {
  const {useListQuery} = useAdminApi(api, model.routePath, model.name);
  const {data, isLoading} = useListQuery({limit: 1, page: 1}, {skip: !model.routePath});
  const total = (data as {total?: number} | undefined)?.total;
  const fieldCount = Object.keys(model.fields).length;

  const onOpen = useCallback((): void => {
    const prefix = routeBase.endsWith("/") ? routeBase.slice(0, -1) : routeBase;
    const href = `${prefix}/${model.name}` as Href;
    router.push(href);
  }, [routeBase, model.name]);

  return (
    <Box
      accessibilityHint={`Open ${model.displayName} admin`}
      accessibilityLabel={model.displayName}
      border="default"
      onClick={onOpen}
      padding={3}
      rounding="md"
      testID={`admin-home-models-grid-${model.name}`}
      width={200}
    >
      <Text bold>{model.displayName}</Text>
      <Text color="secondaryDark" size="sm">
        {`${fieldCount} fields`}
      </Text>
      <Box marginTop={1}>
        {isLoading ? (
          <Spinner />
        ) : (
          <Text
            color="secondaryDark"
            size="sm"
            testID={`admin-home-model-count-${model.name}`}
          >{`${total != null ? total : "—"} rows`}</Text>
        )}
      </Box>
    </Box>
  );
};

const ModelsGridWidget: React.FC<{
  api: AdminApi;
  models: AdminModelConfig[];
  routeBase: string;
}> = ({api, models, routeBase}) => {
  return (
    <Card padding={4} testID="admin-home-widget-modelsGrid">
      <Heading size="sm">Models</Heading>
      <Box direction="row" gap={3} marginTop={2} wrap>
        {models.map((m) => (
          <ModelGridCard api={api} key={m.name} model={m} routeBase={routeBase} />
        ))}
      </Box>
    </Card>
  );
};

const FeatureFlagsOverridesWidget: React.FC<{
  model?: AdminModelConfig;
  routeBase: string;
}> = ({model, routeBase}) => {
  const onOpen = useCallback((): void => {
    if (!model) {
      return;
    }
    const prefix = routeBase.endsWith("/") ? routeBase.slice(0, -1) : routeBase;
    router.push(`${prefix}/${model.name}` as Href);
  }, [routeBase, model]);

  return (
    <Card padding={4} testID="admin-home-widget-feature-flags-overrides">
      <Heading size="sm">Feature flags</Heading>
      {model ? (
        <Box marginTop={2}>
          <Text color="secondaryDark" size="sm">
            Quick access to feature flag records.
          </Text>
          <Box marginTop={2}>
            <Button onClick={onOpen} text={`Open ${model.displayName}`} variant="outline" />
          </Box>
        </Box>
      ) : (
        <Box marginTop={2}>
          <Text color="secondaryDark" size="sm">
            No FeatureFlag model is registered in this admin config.
          </Text>
        </Box>
      )}
    </Card>
  );
};

const RecentActivityWidget: React.FC<{
  api: AdminApi;
  auditModel?: AdminModelConfig;
}> = ({api, auditModel}) => {
  const {useListQuery} = useAdminApi(api, auditModel?.routePath ?? "", auditModel?.name ?? "");
  const {data, isLoading, isError} = useListQuery(
    {limit: 8, page: 1, sort: "-createdAt"},
    {skip: !auditModel?.routePath}
  );

  const rows = useMemo((): Record<string, AdminFieldValue>[] => {
    const body = data as {data?: Record<string, AdminFieldValue>[]} | undefined;
    return Array.isArray(body?.data) ? body.data : [];
  }, [data]);

  if (!auditModel) {
    return (
      <Card padding={4} testID="admin-home-widget-recentActivity">
        <Heading size="sm">Recent activity</Heading>
        <Box marginTop={2}>
          <Text color="secondaryDark" size="sm">
            Register an AdminAuditLog model to show recent mutations here.
          </Text>
        </Box>
      </Card>
    );
  }

  return (
    <Card padding={4} testID="admin-home-widget-recentActivity">
      <Heading size="sm">Recent activity</Heading>
      {isLoading ? (
        <Box alignItems="center" marginTop={3} padding={2}>
          <Spinner />
        </Box>
      ) : null}
      {isError ? (
        <Box marginTop={2}>
          <Text color="error" size="sm">
            Could not load audit entries.
          </Text>
        </Box>
      ) : null}
      {!isLoading && !isError && rows.length === 0 ? (
        <Box marginTop={2}>
          <Text color="secondaryDark" size="sm">
            No audit entries yet.
          </Text>
        </Box>
      ) : null}
      {!isLoading && !isError && rows.length > 0 ? (
        <Box gap={2} marginTop={2}>
          {rows.map((row) => {
            const id = String(row._id ?? row.id ?? "");
            const verb = String(row.verb ?? "");
            const modelName = String(row.modelName ?? "");
            const label = String(row.recordLabel ?? row.recordId ?? "");
            const created = row.createdAt ?? row.created;
            const when =
              typeof created === "string" ? printDateAndTime(created, {defaultValue: created}) : "";
            return (
              <Box border="default" key={id || `${verb}-${label}`} padding={2} rounding="sm">
                <Text size="sm">
                  <Text bold>{verb}</Text> {modelName}
                  {label ? ` — ${label}` : ""}
                </Text>
                {when ? (
                  <Text color="secondaryDark" size="sm">
                    {when}
                  </Text>
                ) : null}
              </Box>
            );
          })}
        </Box>
      ) : null}
    </Card>
  );
};

const ScriptRunnerWidget: React.FC<{routeBase: string}> = ({routeBase}) => {
  const onScripts = useCallback((): void => {
    const prefix = routeBase.endsWith("/") ? routeBase.slice(0, -1) : routeBase;
    router.push(`${prefix}/__scripts` as Href);
  }, [routeBase]);

  return (
    <Card padding={4} testID="admin-home-widget-scriptRunner">
      <Heading size="sm">Scripts</Heading>
      <Box marginTop={1}>
        <Text color="secondaryDark" size="sm">
          Run registered admin maintenance scripts.
        </Text>
      </Box>
      <Box marginTop={2}>
        <Button onClick={onScripts} text="Open scripts" variant="primary" />
      </Box>
    </Card>
  );
};

const renderWidget = (params: {
  api: AdminApi;
  apiBase: string;
  routeBase: string;
  widgetId: string;
  models: AdminModelConfig[];
  auditModel?: AdminModelConfig;
  featureFlagModel?: AdminModelConfig;
}): React.ReactNode => {
  const {api, apiBase, routeBase, widgetId, models, auditModel, featureFlagModel} = params;
  warnUnknownWidget(widgetId);
  switch (widgetId) {
    case "modelStats":
      return <ModelsGridWidget api={api} models={models} routeBase={routeBase} />;
    case "modelsGrid":
      return <ModelsGridWidget api={api} models={models} routeBase={routeBase} />;
    case "feature-flags-overrides":
      return <FeatureFlagsOverridesWidget model={featureFlagModel} routeBase={routeBase} />;
    case "versionConfig":
      return <AdminVersionConfig api={api} apiBase={apiBase} embedded routeBase={routeBase} />;
    case "scriptRunner":
      return <ScriptRunnerWidget routeBase={routeBase} />;
    case "recentActivity":
      return <RecentActivityWidget api={api} auditModel={auditModel} />;
    default:
      return null;
  }
};

/**
 * Config-driven admin home dashboard: renders `home.slots` from `/admin/config` with built-in
 * widgets (model grid with counts, scripts, version config, audit recent activity).
 */
export const AdminHome: React.FC<AdminHomeProps> = ({
  baseUrl,
  apiBase,
  routeBase,
  api,
  embedded = false,
}) => {
  const {apiBase: resolvedApiBase, routeBase: resolvedRouteBase} = resolveAdminBases({
    apiBase,
    baseUrl,
    routeBase,
  });
  const {config, error, isLoading} = useAdminConfig(api, resolvedApiBase);

  const models = (config?.models ?? []) as AdminModelConfig[];
  const auditModel = useMemo(
    () => models.find((m) => m.name === "AdminAuditLog" || m.routePath.includes("audit-log")),
    [models]
  );
  const featureFlagModel = useMemo(
    () => models.find((m) => m.name === "FeatureFlag" || m.displayName === "Feature Flags"),
    [models]
  );

  const slots = config?.home?.slots;
  const navGlobal = normalizeWidgetIds(slots?.navGlobal);
  const contentTop = normalizeWidgetIds(slots?.contentTop);
  const main = normalizeWidgetIds(slots?.main);
  const sidebar = normalizeSidebarWidgets(slots?.sidebar);

  if (isLoading) {
    const loadingBody = (
      <Box alignItems="center" justifyContent="center" padding={6} testID="admin-home-loading">
        <Spinner />
      </Box>
    );
    if (embedded) {
      return loadingBody;
    }
    return (
      <Page maxWidth="100%" title={config?.home?.title ?? "Admin"}>
        {loadingBody}
      </Page>
    );
  }

  if (error || !config) {
    const errorBody = (
      <Box padding={4} testID="admin-home-error">
        <Text color="error">Failed to load admin configuration.</Text>
      </Box>
    );
    if (embedded) {
      return errorBody;
    }
    return (
      <Page maxWidth="100%" title="Admin">
        {errorBody}
      </Page>
    );
  }

  const title = config.home?.title ?? "Admin";

  const widgetParams = {
    api,
    apiBase: resolvedApiBase,
    auditModel,
    featureFlagModel,
    models,
    routeBase: resolvedRouteBase,
  };

  const dashboardBody = (
    <Box gap={4} padding={embedded ? 0 : 4} width="100%">
      {!embedded ? <Heading size="md">{title}</Heading> : null}

      {navGlobal.length > 0 ? (
        <Box direction="row" gap={3} testID="admin-home-slot-navGlobal" wrap>
          {navGlobal.map((id) => (
            <Box key={`ng-${id}`}>{renderWidget({...widgetParams, widgetId: id})}</Box>
          ))}
        </Box>
      ) : null}

      {contentTop.length > 0 ? (
        <Box direction="column" gap={3} testID="admin-home-slot-contentTop">
          {contentTop.map((id) => (
            <Box key={`ct-${id}`}>{renderWidget({...widgetParams, widgetId: id})}</Box>
          ))}
        </Box>
      ) : null}

      <Box alignItems="start" direction={embedded ? "column" : "row"} gap={4}>
        {main.length > 0 ? (
          <Box
            flex="grow"
            gap={3}
            minWidth={embedded ? 0 : 280}
            testID="admin-home-slot-main"
            width={embedded ? "100%" : undefined}
          >
            {main.map((id) => (
              <Box key={`mn-${id}`}>{renderWidget({...widgetParams, widgetId: id})}</Box>
            ))}
          </Box>
        ) : null}
        {sidebar.length > 0 ? (
          <Box
            direction="column"
            gap={3}
            minWidth={embedded ? 0 : 280}
            testID="admin-home-slot-sidebar"
            width={embedded ? "100%" : 320}
          >
            {sidebar.map((id) => (
              <Box key={`sb-${id}`}>{renderWidget({...widgetParams, widgetId: id})}</Box>
            ))}
          </Box>
        ) : null}
      </Box>
    </Box>
  );

  if (embedded) {
    return dashboardBody;
  }

  return (
    <Page maxWidth="100%" scroll title={title}>
      {dashboardBody}
    </Page>
  );
};
