import {AdminShellLayout} from "@terreno/admin-frontend";
import {Stack} from "expo-router";
import React from "react";
import {terrenoApi} from "@/store/sdk";
import {ADMIN_CUSTOM_SCREENS, ADMIN_ROUTE} from "./adminConstants";

/**
 * Admin UI v2 shell for the whole `/admin/**` stack: sidebar (models, tools, screens) + main
 * column (stack navigator).
 */
const AdminLayout: React.FC = () => {
  return (
    <AdminShellLayout
      api={terrenoApi}
      apiBase={ADMIN_ROUTE}
      configurationPath="/admin/configuration"
      customScreens={ADMIN_CUSTOM_SCREENS}
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
        <Stack.Screen name="consent-forms" options={{title: "Consent forms"}} />
        <Stack.Screen name="consent-responses" options={{title: "Consent responses"}} />
        <Stack.Screen name="[model]" options={{title: "Model"}} />
      </Stack>
    </AdminShellLayout>
  );
};

export default AdminLayout;
