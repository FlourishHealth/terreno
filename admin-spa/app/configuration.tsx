import {ConfigurationScreen} from "@terreno/admin-frontend";
import React from "react";
import {AdminSpaShell} from "../components/AdminSpaShell";
import {terrenoApi} from "../store/sdk";

const ConfigurationRoute: React.FC = () => {
  return (
    <AdminSpaShell breadcrumbs={[{href: "/", label: "Admin"}, {label: "Configuration"}]}>
      <ConfigurationScreen api={terrenoApi} title="App Configuration" />
    </AdminSpaShell>
  );
};

export default ConfigurationRoute;
