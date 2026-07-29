import {AdminRolesList, AdminShellLayout} from "@terreno/admin-frontend";
import React from "react";

import {useAppConfig} from "../components/AppConfigGate";
import {terrenoApi} from "../store/sdk";

const RolesRoute: React.FC = () => {
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";

  return (
    <AdminShellLayout
      api={terrenoApi}
      apiBase={apiBase}
      breadcrumbs={[{href: "/", label: "Admin"}, {label: "Roles"}]}
      configurationPath="/configuration"
      routeBase=""
    >
      <AdminRolesList api={terrenoApi} apiBase={apiBase} routeBase="" />
    </AdminShellLayout>
  );
};

export default RolesRoute;
