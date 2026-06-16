import {AdminShell, ConfigurationScreen} from "@terreno/admin-frontend";
import React from "react";
import {useAppConfig} from "../components/AppConfigGate";
import {terrenoApi} from "../store/sdk";

const ConfigurationRoute: React.FC = () => {
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";

  return (
    <AdminShell
      api={terrenoApi}
      apiBase={apiBase}
      breadcrumbs={[{href: "/", label: "Admin"}, {label: "Configuration"}]}
      configurationPath="/configuration"
      routeBase=""
    >
      <ConfigurationScreen api={terrenoApi} title="App Configuration" />
    </AdminShell>
  );
};

export default ConfigurationRoute;
