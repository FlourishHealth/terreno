import {AdminModelForm} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const ADMIN_BASE_URL = "/admin";

const AdminEditScreen: React.FC = () => {
  const {model, id} = useLocalSearchParams<{model: string; id: string}>();
  return (
    <AdminModelForm
      api={terrenoApi}
      baseUrl={ADMIN_BASE_URL}
      itemId={id}
      mode="edit"
      modelName={model}
    />
  );
};

export default AdminEditScreen;
