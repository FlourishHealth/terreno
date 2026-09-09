import {AdminShellLayout, CommsDashboardScreenWidget} from "@terreno/admin-frontend";
import React from "react";
import {useAppConfig} from "../../components/AppConfigGate";
import {terrenoApi} from "../../store/sdk";

const CommsAdminRoute: React.FC = () => {
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";

  return (
    <AdminShellLayout
      api={terrenoApi}
      apiBase={apiBase}
      breadcrumbs={[{href: "/", label: "Admin"}, {label: "Comms"}]}
      configurationPath="/configuration"
      rolesPath="/roles"
      routeBase=""
    >
      <CommsDashboardScreenWidget
        api={terrenoApi}
        config={{customScreens: [], models: [], scripts: []}}
        routeBase=""
        screenName="comms"
      />
    </AdminShellLayout>
  );
};

export default CommsAdminRoute;
