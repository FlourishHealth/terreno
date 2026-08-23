import {AdminProvider, AdminShellLayout} from "@terreno/admin-frontend";
import {Stack} from "expo-router";
import React from "react";
import {ADMIN_ROUTE} from "@/constants/adminConstants";
import {terrenoApi} from "@/store/sdk";
import SyncLabScreen from "./SyncLabScreen";

/**
 * Admin UI v2 shell for the whole `/admin/**` stack: sidebar (models, tools, screens) + main
 * column (stack navigator).
 */
const AdminLayout: React.FC = () => {
  return (
    <AdminProvider
      api={terrenoApi}
      apiBase={ADMIN_ROUTE}
      routeBase={ADMIN_ROUTE}
      widgets={{screens: {"sync-lab": SyncLabScreen}}}
    >
      <AdminShellLayout
        api={terrenoApi}
        apiBase={ADMIN_ROUTE}
        configurationPath="/admin/configuration"
        rolesPath="/roles"
        routeBase={ADMIN_ROUTE}
        versionConfigPath="/version-config"
      >
        <Stack
          screenOptions={{
            contentStyle: {flex: 1},
            headerShown: false,
          }}
        >
          <Stack.Screen name="index" options={{title: "Admin"}} />
          <Stack.Screen name="showcase" options={{title: "Admin UI v2 map"}} />
          <Stack.Screen name="configuration" options={{title: "Configuration"}} />
          <Stack.Screen name="roles" options={{title: "Roles"}} />
          <Stack.Screen name="consent-forms/index" options={{title: "Consent forms"}} />
          <Stack.Screen name="consent-responses/index" options={{title: "Consent responses"}} />
          <Stack.Screen name="[model]" options={{title: "Model"}} />
        </Stack>
      </AdminShellLayout>
    </AdminProvider>
  );
};

export default AdminLayout;
