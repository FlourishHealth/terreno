import {AdminModelList, type AdminCustomScreen} from "@terreno/admin-frontend";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const CUSTOM_SCREENS: AdminCustomScreen[] = [
  {
    description: "View AI request logs and usage",
    displayName: "AI Admin",
    name: "ai-admin",
  },
];

const AdminListScreen: React.FC = () => {
  return (
    <AdminModelList
      api={terrenoApi}
      baseUrl="/admin"
      configurationPath="/admin/configuration"
      customScreens={CUSTOM_SCREENS}
    />
  );
};

export default AdminListScreen;
