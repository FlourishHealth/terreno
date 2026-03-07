import {AdminModelList} from "@terreno/admin-frontend";
import {Box, Card, Heading, Text} from "@terreno/ui";
import {router} from "expo-router";
import React, {useCallback} from "react";
import {terrenoApi} from "@/store/sdk";

const ADMIN_BASE_URL = "/admin";

const AdminListScreen: React.FC = () => {
  const handleConfigPress = useCallback(() => {
    // biome-ignore lint/suspicious/noExplicitAny: expo-router typed routes
    router.push("/admin/configuration" as any);
  }, []);

  return (
    <Box>
      <Box padding={4} paddingBottom={0}>
        <Card padding={4}>
          <Box gap={2} onClick={handleConfigPress} width={240}>
            <Heading size="md">Configuration</Heading>
            <Text color="secondaryDark" size="sm">
              Manage application settings
            </Text>
          </Box>
        </Card>
      </Box>
      <AdminModelList api={terrenoApi} baseUrl={ADMIN_BASE_URL} />
    </Box>
  );
};

export default AdminListScreen;
