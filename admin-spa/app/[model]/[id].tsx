import {AdminModelForm, AdminShellLayout, useAdminConfig} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React, {useMemo} from "react";
import {useAppConfig} from "../../components/AppConfigGate";
import {terrenoApi} from "../../store/sdk";

const ModelEditScreen: React.FC = () => {
  const {model, id} = useLocalSearchParams<{model: string; id: string}>();
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";
  const {config} = useAdminConfig(terrenoApi, apiBase);

  const breadcrumbs = useMemo(() => {
    const trail: {href?: string; label: string}[] = [{href: "/", label: "Admin"}];
    const meta = config?.models.find((m) => m.name === model);
    const listLabel = meta?.displayName ?? model ?? "Model";
    trail.push({href: `/${model}`, label: listLabel});
    trail.push({label: "Edit"});
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
        itemId={id}
        mode="edit"
        modelName={model}
        routeBase=""
      />
    </AdminShellLayout>
  );
};

export default ModelEditScreen;
