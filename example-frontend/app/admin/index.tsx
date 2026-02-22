import {AdminModelList} from "@terreno/admin-frontend";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const ADMIN_BASE_URL = "/admin";

const AdminListScreen: React.FC = () => {
  return <AdminModelList api={terrenoApi} baseUrl={ADMIN_BASE_URL} />;
};

export default AdminListScreen;
