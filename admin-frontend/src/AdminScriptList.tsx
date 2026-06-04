import {Box, Button, Card, Heading, Page, Spinner, Text} from "@terreno/ui";
import React, {useCallback, useState} from "react";
import {AdminScriptRunModal} from "./AdminScriptRunModal";
import {type AdminApi, type AdminScriptConfig, resolveAdminBases} from "./types";
import {useAdminConfig} from "./useAdminConfig";

interface AdminScriptListProps {
  /** @deprecated Use `apiBase`/`routeBase`. Kept as a backward-compatible alias. */
  baseUrl?: string;
  /** Base path where admin API requests are sent. Falls back to `baseUrl`. */
  apiBase?: string;
  /** Base path used for in-app navigation. Falls back to `baseUrl`. */
  routeBase?: string;
  api: AdminApi;
  /** When false, the Run button is disabled. Defaults to true. */
  isAdmin?: boolean;
}

export const AdminScriptList: React.FC<AdminScriptListProps> = ({
  baseUrl,
  apiBase,
  routeBase,
  api,
  isAdmin = true,
}) => {
  const {apiBase: resolvedApiBase, routeBase: resolvedRouteBase} = resolveAdminBases({
    apiBase,
    baseUrl,
    routeBase,
  });
  const {config, isLoading, error} = useAdminConfig(api, resolvedApiBase);
  const [selectedScript, setSelectedScript] = useState<AdminScriptConfig | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleRunScript = useCallback((script: AdminScriptConfig) => {
    setSelectedScript(script);
    setModalVisible(true);
  }, []);

  const handleDismiss = useCallback(() => {
    setModalVisible(false);
    setSelectedScript(null);
  }, []);

  if (isLoading) {
    return (
      <Page maxWidth="100%" title="Scripts">
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  if (error || !config) {
    return (
      <Page maxWidth="100%" title="Scripts">
        <Box padding={4}>
          <Text color="error">Failed to load admin configuration.</Text>
        </Box>
      </Page>
    );
  }

  const scripts = config.scripts ?? [];

  if (scripts.length === 0) {
    return (
      <Page maxWidth="100%" title="Scripts">
        <Box alignItems="center" padding={6}>
          <Text color="secondaryDark">No scripts registered.</Text>
        </Box>
      </Page>
    );
  }

  return (
    <Page maxWidth="100%" scroll title="Scripts">
      <Box gap={3} padding={4}>
        {scripts.map((script: AdminScriptConfig) => (
          <Card key={script.name} padding={4} testID={`admin-script-card-${script.name}`}>
            <Box alignItems="center" direction="row" gap={4} justifyContent="between">
              <Box flex="grow" gap={1}>
                <Heading size="sm">{script.name}</Heading>
                <Text color="secondaryDark" size="sm">
                  {script.description}
                </Text>
              </Box>
              <Button
                disabled={!isAdmin}
                onClick={() => handleRunScript(script)}
                testID={`admin-script-run-${script.name}`}
                text="Run"
                tooltipText={!isAdmin ? "Only admins can run scripts" : undefined}
                variant="primary"
              />
            </Box>
          </Card>
        ))}
      </Box>

      <AdminScriptRunModal
        api={api}
        apiBase={resolvedApiBase}
        onDismiss={handleDismiss}
        routeBase={resolvedRouteBase}
        scriptDescription={selectedScript?.description}
        scriptName={selectedScript?.name ?? null}
        visible={modalVisible}
      />
    </Page>
  );
};
