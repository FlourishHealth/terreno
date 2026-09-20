import {CommsDashboardScreenWidget} from "@terreno/admin-frontend";
import React from "react";
import {AdminSpaShell} from "../../components/AdminSpaShell";
import {terrenoApi} from "../../store/sdk";

const CommsAdminRoute: React.FC = () => {
  return (
    <AdminSpaShell breadcrumbs={[{href: "/", label: "Admin"}, {label: "Comms"}]}>
      <CommsDashboardScreenWidget
        api={terrenoApi}
        config={{customScreens: [], models: [], scripts: []}}
        routeBase=""
        screenName="comms"
      />
    </AdminSpaShell>
  );
};

export default CommsAdminRoute;
