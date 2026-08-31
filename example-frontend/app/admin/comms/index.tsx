import {CommsDashboardScreenWidget} from "@terreno/admin-frontend";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const ADMIN_BASE_URL = "/admin";

const CommsAdminScreen: React.FC = () => {
  return (
    <CommsDashboardScreenWidget
      api={terrenoApi}
      config={{customScreens: [], models: [], scripts: []}}
      routeBase={ADMIN_BASE_URL}
      screenName="comms"
    />
  );
};

export default CommsAdminScreen;
