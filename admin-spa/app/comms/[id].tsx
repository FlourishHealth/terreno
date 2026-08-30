import {AdminShellLayout, CommsMessageDetail} from "@terreno/admin-frontend";
import {useLocalSearchParams} from "expo-router";
import React from "react";
import {useAppConfig} from "../../components/AppConfigGate";
import {terrenoApi} from "../../store/sdk";

const CommsMessageAdminRoute: React.FC = () => {
  const {id} = useLocalSearchParams<{id: string}>();
  const {appConfig} = useAppConfig();
  const apiBase = appConfig.adminApiBasePath ?? "/admin";
  const messageId = Array.isArray(id) ? id[0] : (id ?? "");

  return (
    <AdminShellLayout
      api={terrenoApi}
      apiBase={apiBase}
      breadcrumbs={[
        {href: "/", label: "Admin"},
        {href: "/comms", label: "Comms"},
        {label: "Message"},
      ]}
      configurationPath="/configuration"
      rolesPath="/roles"
      routeBase=""
    >
      <CommsMessageDetail api={terrenoApi} messageId={messageId} routeBase="" />
    </AdminShellLayout>
  );
};

export default CommsMessageAdminRoute;
