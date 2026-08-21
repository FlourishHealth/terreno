import {AdminScreenRouter, AdminShellLayout, useAdminConfig} from "@terreno/admin-frontend";
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

  return (
    <AdminShellLayout
      api={terrenoApi}
      apiBase={apiBase}
      breadcrumbs={breadcrumbs}
      configurationPath="/configuration"
      routeBase=""
    >
      <AdminScreenRouter api={terrenoApi} apiBase={apiBase} name={model} routeBase="" />
    </AdminShellLayout>
  );
};

export default ModelTableScreen;
