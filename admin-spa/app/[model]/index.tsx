import {
  AdminModelTable,
  AdminScriptList,
  AdminShell,
  AdminVersionConfig,
  useAdminConfig,
} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React, {useMemo} from "react";
import {useAppConfig} from "../../components/AppConfigGate";
import {terrenoApi} from "../../store/sdk";

const ModelTableScreen: React.FC = () => {
  const {model} = useLocalSearchParams<{model: string}>();
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";
  const {config} = useAdminConfig(terrenoApi, apiBase);

  const breadcrumbs = useMemo(() => {
    const trail: {href?: string; label: string}[] = [{href: "/", label: "Admin"}];
    if (model === "__scripts") {
      trail.push({label: "Scripts"});
      return trail;
    }
    if (model === "version-config") {
      trail.push({label: "Version configuration"});
      return trail;
    }
    const meta = config?.models.find((m) => m.name === model);
    trail.push({label: meta?.displayName ?? model ?? "Model"});
    return trail;
  }, [config?.models, model]);

  const inner = (() => {
    if (model === "__scripts") {
      return <AdminScriptList api={terrenoApi} apiBase={apiBase} isAdmin routeBase="" />;
    }

    if (model === "version-config") {
      return <AdminVersionConfig api={terrenoApi} apiBase={apiBase} routeBase="" />;
    }

    return <AdminModelTable api={terrenoApi} apiBase={apiBase} modelName={model} routeBase="" />;
  })();

  return (
    <AdminShell
      api={terrenoApi}
      apiBase={apiBase}
      breadcrumbs={breadcrumbs}
      configurationPath="/configuration"
      routeBase=""
    >
      {inner}
    </AdminShell>
  );
};

export default ModelTableScreen;
