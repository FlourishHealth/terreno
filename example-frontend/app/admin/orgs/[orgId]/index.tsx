import {OrgSettingsScreen} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const OrgSettingsRoute: React.FC = () => {
  const {orgId} = useLocalSearchParams<{orgId: string}>();
  return <OrgSettingsScreen api={terrenoApi} organizationId={orgId} routeBase="/admin" />;
};

export default OrgSettingsRoute;
