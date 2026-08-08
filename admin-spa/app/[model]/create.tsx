import {AdminModelForm, AdminShellLayout, useAdminConfig} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React, {useMemo} from "react";
import {useAppConfig} from "../../components/AppConfigGate";
import {terrenoApi} from "../../store/sdk";

const ModelCreateScreen: React.FC = () => {
  const {model} = useLocalSearchParams<{model: string}>();
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";
  const {config} = useAdminConfig(terrenoApi, apiBase);

  const breadcrumbs = useMemo(() => {
    const trail: {href?: string; label: string}[] = [{href: "/", label: "Admin"}];
    const meta = config?.models.find((m) => m.name === model);
    const listLabel = meta?.displayName ?? model ?? "Model";
    trail.push({href: `/${model}`, label: listLabel});
    trail.push({label: "Create"});
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
      <AdminModelForm
        api={terrenoApi}
        apiBase={apiBase}
        mode="create"
        modelName={model}
        routeBase=""
      />
    </AdminShellLayout>
  );
};

export default ModelCreateScreen;
