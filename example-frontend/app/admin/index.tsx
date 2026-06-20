import {type AdminCustomScreen, AdminHome, AdminModelList} from "@terreno/admin-frontend";
import {Box, Page} from "@terreno/ui";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const CUSTOM_SCREENS: AdminCustomScreen[] = [
  {
    description: "View AI request logs and usage",
    displayName: "AI Admin",
    name: "ai-admin",
  },
];

const ADMIN_ROUTE = "/admin";

const AdminListScreen: React.FC = () => {
  return (
    <Page maxWidth="100%" scroll title="Admin">
      <Box gap={4} padding={4}>
        <AdminHome api={terrenoApi} baseUrl={ADMIN_ROUTE} embedded />
        <AdminModelList
          api={terrenoApi}
          baseUrl={ADMIN_ROUTE}
          configurationPath="/admin/configuration"
          customScreens={CUSTOM_SCREENS}
          embedded
        />
      </Box>
    </Page>
  );
};

export default AdminListScreen;
