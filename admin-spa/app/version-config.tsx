import {AdminShellLayout, AdminVersionConfig} from "@terreno/admin-frontend";
import React from "react";
import {useAppConfig} from "../components/AppConfigGate";
import {terrenoApi} from "../store/sdk";

const VersionConfigRoute: React.FC = () => {
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";

  return (
    <AdminShellLayout
      api={terrenoApi}
      apiBase={apiBase}
      breadcrumbs={[{href: "/", label: "Admin"}, {label: "Version configuration"}]}
      configurationPath="/configuration"
      routeBase=""
    >
      <AdminVersionConfig api={terrenoApi} apiBase={apiBase} routeBase="" />
    </AdminShellLayout>
  );
};

export default VersionConfigRoute;
