import {AdminProvider, AdminShellLayout} from "@terreno/admin-frontend";
import {canOpenAdminPage, selectBetterAuthUserId} from "@terreno/rtk";
import {Box, Spinner, Text} from "@terreno/ui";
import {Stack} from "expo-router";
import React from "react";
import {useSelector} from "react-redux";
import {ADMIN_ROUTE} from "@/constants/adminConstants";
import {terrenoApi, useGetMeQuery} from "@/store/sdk";
import SyncLabScreen from "./SyncLabScreen";

/**
 * Admin UI v2 shell for the whole `/admin/**` stack: sidebar (models, tools, screens) + main
 * column (stack navigator). `admin:access` is the only permission that opens this page.
 */
const AdminLayout: React.FC = () => {
  const userId = useSelector(selectBetterAuthUserId);
  const {data: profile, isLoading} = useGetMeQuery(undefined, {skip: !userId});
  const canOpen = canOpenAdminPage({
    admin: profile?.admin,
    permissions: profile?.permissions,
  });

  if (userId && isLoading) {
    return (
      <Box
        alignItems="center"
        flex="grow"
        justifyContent="center"
        padding={6}
        testID="admin-page-loading"
      >
        <Spinner />
      </Box>
    );
  }

  if (userId && !canOpen) {
    return (
      <Box padding={4} testID="admin-page-forbidden">
        <Text>
          You do not have permission to open the admin page. Grant the admin:access permission.
        </Text>
      </Box>
    );
  }

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
