import {OrgSettingsScreen} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React from "react";
import {AdminSpaShell} from "../../../components/AdminSpaShell";
import {terrenoApi} from "../../../store/sdk";

const OrgSettingsRoute: React.FC = () => {
  const {orgId} = useLocalSearchParams<{orgId: string}>();
  return (
    <AdminSpaShell
      breadcrumbs={[
        {href: "/", label: "Admin"},
        {href: "/orgs", label: "Organizations"},
        {label: "Settings"},
      ]}
    >
      <OrgSettingsScreen api={terrenoApi} organizationId={orgId} routeBase="" />
    </AdminSpaShell>
  );
};

export default OrgSettingsRoute;
