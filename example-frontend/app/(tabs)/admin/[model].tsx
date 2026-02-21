import {AdminModelTable} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const ADMIN_BASE_URL = "/admin";

const AdminTableScreen: React.FC = () => {
  const {model} = useLocalSearchParams<{model: string}>();
  return <AdminModelTable api={terrenoApi} baseUrl={ADMIN_BASE_URL} modelName={model} />;
};

export default AdminTableScreen;
