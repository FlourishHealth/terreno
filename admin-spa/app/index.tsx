import {AdminHome, AdminShell} from "@terreno/admin-frontend";
import React from "react";
import {useAppConfig} from "../components/AppConfigGate";
import {terrenoApi} from "../store/sdk";

const AdminIndexScreen: React.FC = () => {
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";

  // routeBase="" keeps navigation inside the SPA's own router root (expo-router applies
  // the mount baseUrl); apiBase points data fetching at the admin API on the same origin.
  return (
    <AdminShell
      api={terrenoApi}
      apiBase={apiBase}
      breadcrumbs={[{label: "Home"}]}
      configurationPath="/configuration"
      routeBase=""
    >
      <AdminHome api={terrenoApi} apiBase={apiBase} routeBase="" />
    </AdminShell>
  );
};

export default AdminIndexScreen;
