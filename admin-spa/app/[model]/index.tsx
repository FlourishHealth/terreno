import {AdminModelTable, AdminScriptList, AdminVersionConfig} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React from "react";
import {useAppConfig} from "../../components/AppConfigGate";
import {terrenoApi} from "../../store/sdk";

const ModelTableScreen: React.FC = () => {
  const {model} = useLocalSearchParams<{model: string}>();
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";

  if (model === "__scripts") {
    return <AdminScriptList api={terrenoApi} apiBase={apiBase} isAdmin routeBase="" />;
  }

  if (model === "version-config") {
    return <AdminVersionConfig api={terrenoApi} apiBase={apiBase} routeBase="" />;
  }

  return <AdminModelTable api={terrenoApi} apiBase={apiBase} modelName={model} routeBase="" />;
};

export default ModelTableScreen;
