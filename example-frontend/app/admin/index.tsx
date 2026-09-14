import {AdminHome} from "@terreno/admin-frontend";
import React from "react";
import {ADMIN_ROUTE} from "@/constants/adminConstants";
import {terrenoApi} from "@/store/sdk";

const AdminListScreen: React.FC = () => {
  return <AdminHome api={terrenoApi} baseUrl={ADMIN_ROUTE} />;
};

export default AdminListScreen;
