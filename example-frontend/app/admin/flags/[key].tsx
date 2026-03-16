import {FlagDetail} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const ADMIN_BASE_URL = "/admin";

const FlagDetailScreen: React.FC = () => {
  const {key} = useLocalSearchParams<{key: string}>();

  return <FlagDetail api={terrenoApi} baseUrl={ADMIN_BASE_URL} flagKey={key} />;
};

export default FlagDetailScreen;
