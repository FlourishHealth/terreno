import {ConsentFormEditor} from "@terreno/admin-frontend";
import {useRouter} from "expo-router";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const ADMIN_BASE_URL = "/admin";

const CreateConsentFormScreen: React.FC = () => {
  const router = useRouter();
  return (
    <ConsentFormEditor
      api={terrenoApi}
      baseUrl={ADMIN_BASE_URL}
      onCancel={() => router.back()}
      onSave={() => router.back()}
    />
  );
};

export default CreateConsentFormScreen;
