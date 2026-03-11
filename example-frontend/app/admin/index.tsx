import {AdminModelList} from "@terreno/admin-frontend";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const AdminListScreen: React.FC = () => {
  return (
    <AdminModelList api={terrenoApi} baseUrl="/admin" configurationPath="/admin/configuration" />
  );
};

export default AdminListScreen;
