import {ConsentFormEditor} from "@terreno/admin-frontend";
import {useLocalSearchParams, useRouter} from "expo-router";
import React from "react";
import {terrenoApi} from "@/store/sdk";
import {CONSENT_SUPPORTED_LOCALES} from "./constants";

const ADMIN_BASE_URL = "/admin";

const EditConsentFormScreen: React.FC = () => {
  const router = useRouter();
  const {id} = useLocalSearchParams<{id: string}>();
  return (
    <ConsentFormEditor
      api={terrenoApi}
      baseUrl={ADMIN_BASE_URL}
      hasAiSupport
      id={id}
      onCancel={() => router.back()}
      onSave={() => router.back()}
      supportedLocales={CONSENT_SUPPORTED_LOCALES}
    />
  );
};

export default EditConsentFormScreen;
