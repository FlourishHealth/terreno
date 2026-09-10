import {AdminHome} from "@terreno/admin-frontend";
import React from "react";
import {AdminSpaShell} from "../components/AdminSpaShell";
import {useAppConfig} from "../components/AppConfigGate";
import {terrenoApi} from "../store/sdk";

const AdminIndexScreen: React.FC = () => {
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";

  return (
    <AdminSpaShell breadcrumbs={[{label: "Admin"}]}>
      <AdminHome api={terrenoApi} apiBase={apiBase} routeBase="" />
    </AdminSpaShell>
  );
};

export default AdminIndexScreen;
