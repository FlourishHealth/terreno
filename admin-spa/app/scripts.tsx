import {AdminScriptList} from "@terreno/admin-frontend";
import React from "react";
import {useAppConfig} from "../components/AppConfigGate";
import {terrenoApi} from "../store/sdk";

const ScriptsRoute: React.FC = () => {
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";

  return <AdminScriptList api={terrenoApi} apiBase={apiBase} isAdmin routeBase="" />;
};

export default ScriptsRoute;
