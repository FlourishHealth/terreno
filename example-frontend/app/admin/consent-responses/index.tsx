import {AdminModelTable} from "@terreno/admin-frontend";
import {useRouter} from "expo-router";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const ADMIN_BASE_URL = "/admin";

const ConsentResponsesScreen: React.FC = () => {
  const router = useRouter();
  return (
    <AdminModelTable
      api={terrenoApi}
      baseUrl={ADMIN_BASE_URL}
      modelName="consent-responses"
      onRowClick={(id: string) => router.push(`/admin/consent-responses/${id}`)}
    />
  );
};

export default ConsentResponsesScreen;
