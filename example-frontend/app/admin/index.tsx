import {AdminHome, AdminModelList} from "@terreno/admin-frontend";
import {Box, Page} from "@terreno/ui";
import React from "react";
import {ADMIN_CUSTOM_SCREENS, ADMIN_ROUTE} from "@/constants/adminConstants";
import {terrenoApi} from "@/store/sdk";

const AdminListScreen: React.FC = () => {
  return (
    <Page maxWidth="100%" scroll title="Admin">
      <Box gap={4} padding={0}>
        <AdminHome api={terrenoApi} baseUrl={ADMIN_ROUTE} embedded />
        {/* Models grid lives in AdminHome (main slot); this block only adds tool/custom-screen cards. */}
        <AdminModelList
          api={terrenoApi}
          baseUrl={ADMIN_ROUTE}
          configurationPath="/admin/configuration"
          customScreens={ADMIN_CUSTOM_SCREENS}
          embedded
          hideModelsSection
        />
      </Box>
    </Page>
  );
};

export default AdminListScreen;
