import {AdminShellLayout, ConfigurationScreen} from "@terreno/admin-frontend";
import React from "react";
import {useAppConfig} from "../components/AppConfigGate";
import {terrenoApi} from "../store/sdk";

const ConfigurationRoute: React.FC = () => {
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";

  return (
    <AdminShellLayout
      api={terrenoApi}
      apiBase={apiBase}
      breadcrumbs={[{href: "/", label: "Admin"}, {label: "Configuration"}]}
      configurationPath="/configuration"
      routeBase=""
    >
      <ConfigurationScreen api={terrenoApi} title="App Configuration" />
    </AdminShellLayout>
  );
};

export default ConfigurationRoute;
