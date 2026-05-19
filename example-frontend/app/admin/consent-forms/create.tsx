import {ConsentFormEditor} from "@terreno/admin-frontend";
import {useRouter} from "expo-router";
import React from "react";
import {terrenoApi} from "@/store/sdk";
import {CONSENT_SUPPORTED_LOCALES} from "./constants";

const ADMIN_BASE_URL = "/admin";

const CreateConsentFormScreen: React.FC = () => {
  const router = useRouter();
  return (
    <ConsentFormEditor
      api={terrenoApi}
      baseUrl={ADMIN_BASE_URL}
      hasAiSupport
      onCancel={() => router.back()}
      onSave={() => router.back()}
      supportedLocales={CONSENT_SUPPORTED_LOCALES}
    />
  );
};

export default CreateConsentFormScreen;
