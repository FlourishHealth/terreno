import {AdminModelForm} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React from "react";
import {useAppConfig} from "../../components/AppConfigGate";
import {terrenoApi} from "../../store/sdk";

const ModelCreateScreen: React.FC = () => {
  const {model} = useLocalSearchParams<{model: string}>();
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";

  return (
    <AdminModelForm
      api={terrenoApi}
      apiBase={apiBase}
      mode="create"
      modelName={model}
      routeBase=""
    />
  );
};

export default ModelCreateScreen;
