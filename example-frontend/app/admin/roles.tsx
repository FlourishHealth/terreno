import {AdminRolesList} from "@terreno/admin-frontend";
import React from "react";
import {ADMIN_ROUTE} from "@/constants/adminConstants";
import {terrenoApi} from "@/store/sdk";

const AdminRolesScreen: React.FC = () => {
  return <AdminRolesList api={terrenoApi} apiBase={ADMIN_ROUTE} routeBase={ADMIN_ROUTE} />;
};

export default AdminRolesScreen;
