import {AdminModelTable, AdminScriptList, AdminVersionConfig} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React from "react";
import {useReadProfile} from "@/hooks/useReadProfile";
import {terrenoApi} from "@/store/sdk";

const ADMIN_BASE_URL = "/admin";

const AdminTableScreen: React.FC = () => {
  const {model} = useLocalSearchParams<{model: string}>();
  const profile = useReadProfile();

  if (model === "__scripts") {
    return <AdminScriptList api={terrenoApi} baseUrl={ADMIN_BASE_URL} isAdmin={!!profile?.admin} />;
  }

  if (model === "version-config") {
    return <AdminVersionConfig api={terrenoApi} baseUrl={ADMIN_BASE_URL} />;
  }

  return <AdminModelTable api={terrenoApi} baseUrl={ADMIN_BASE_URL} modelName={model} />;
};

export default AdminTableScreen;
