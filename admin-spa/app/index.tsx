import {AdminModelList} from "@terreno/admin-frontend";
import React from "react";
import {useAppConfig} from "../components/AppConfigGate";
import {terrenoApi} from "../store/sdk";

const ModelListScreen: React.FC = () => {
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";

  // routeBase="" keeps navigation inside the SPA's own router root (expo-router applies
  // the mount baseUrl); apiBase points data fetching at the admin API on the same origin.
  return (
    <AdminModelList
      api={terrenoApi}
      apiBase={apiBase}
      configurationPath="/configuration"
      routeBase=""
    />
  );
};

export default ModelListScreen;
