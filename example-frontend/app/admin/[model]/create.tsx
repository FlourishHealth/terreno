import {AdminModelForm} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const ADMIN_BASE_URL = "/admin";

const AdminCreateScreen: React.FC = () => {
  const {model} = useLocalSearchParams<{model: string}>();
  return (
    <AdminModelForm api={terrenoApi} baseUrl={ADMIN_BASE_URL} mode="create" modelName={model} />
  );
};

export default AdminCreateScreen;
