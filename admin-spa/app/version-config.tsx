import {AdminVersionConfig} from "@terreno/admin-frontend";
import React from "react";
import {useAppConfig} from "../components/AppConfigGate";
import {terrenoApi} from "../store/sdk";

const VersionConfigRoute: React.FC = () => {
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";

  return <AdminVersionConfig api={terrenoApi} apiBase={apiBase} routeBase="" />;
};

export default VersionConfigRoute;
