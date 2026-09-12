import {JobsDashboardScreenWidget} from "@terreno/admin-frontend";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const ADMIN_BASE_URL = "/admin";

const JobsAdminScreen: React.FC = () => {
  return (
    <JobsDashboardScreenWidget
      api={terrenoApi}
      config={{customScreens: [], models: [], scripts: []}}
      routeBase={ADMIN_BASE_URL}
      screenName="jobs"
    />
  );
};

export default JobsAdminScreen;
