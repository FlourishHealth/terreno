import {ConsentResponseViewer} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const ADMIN_BASE_URL = "/admin";

const ConsentResponseScreen: React.FC = () => {
  const {id} = useLocalSearchParams<{id: string}>();
  return <ConsentResponseViewer api={terrenoApi} baseUrl={ADMIN_BASE_URL} id={id} />;
};

export default ConsentResponseScreen;
