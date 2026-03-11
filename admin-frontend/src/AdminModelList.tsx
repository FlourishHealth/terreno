import type {Api} from "@reduxjs/toolkit/query/react";
import {Box, Card, Heading, Page, Spinner, Text} from "@terreno/ui";
import {router} from "expo-router";
import React, {useCallback} from "react";
import type {AdminModelConfig} from "./types";
import {useAdminConfig} from "./useAdminConfig";

interface AdminModelListProps {
  baseUrl: string;
  api: Api<any, any, any, any>;
  /** Path to navigate to for the configuration screen. When provided, a Configuration card is shown. */
  configurationPath?: string;
}

const ScriptsCard: React.FC<{count: number; onPress: () => void}> = ({count, onPress}) => (
  <Card padding={4} testID="admin-scripts-card">
    <Box
      accessibilityHint="Navigate to admin scripts"
      accessibilityLabel="Scripts"
      gap={2}
      onClick={onPress}
      width={240}
    >
      <Heading size="md">Scripts</Heading>
      <Text color="secondaryDark" size="sm">
        {count} script{count !== 1 ? "s" : ""}
      </Text>
    </Box>
  </Card>
);

const ConfigurationCard: React.FC<{onPress: () => void}> = ({onPress}) => (
  <Card padding={4} testID="admin-configuration-card">
    <Box
      accessibilityHint="Navigate to application configuration"
      accessibilityLabel="Configuration"
      gap={2}
      onClick={onPress}
      width={240}
    >
      <Heading size="md">Configuration</Heading>
      <Text color="secondaryDark" size="sm">
        Manage application settings
      </Text>
    </Box>
  </Card>
);

const ModelCard: React.FC<{model: AdminModelConfig; onPress: (name: string) => void}> = ({
  model,
  onPress,
}) => {
  const fieldCount = Object.keys(model.fields).length;
  return (
    <Card key={model.name} padding={4} testID={`admin-model-card-${model.name}`}>
      <Box
        accessibilityHint={`Navigate to ${model.displayName} admin`}
        accessibilityLabel={model.displayName}
        gap={2}
        onClick={() => onPress(model.name)}
        width={240}
      >
        <Heading size="md">{model.displayName}</Heading>
        <Text color="secondaryDark" size="sm">
          {fieldCount} field{fieldCount !== 1 ? "s" : ""}
        </Text>
      </Box>
    </Card>
  );
};

/**
 * Admin panel entry screen that displays all available models as clickable cards.
 *
 * Fetches the admin configuration from the backend and renders a grid of model cards.
 * Each card shows the model's display name and field count. Clicking a card navigates
 * to the model's table view.
 *
 * @param props - Component props
 * @param props.baseUrl - Base URL for admin routes (e.g., "/admin")
 * @param props.api - RTK Query API instance for making authenticated requests
 *
 * @example
 * ```typescript
 * import {AdminModelList} from "@terreno/admin-frontend";
 * import {api} from "@/store/openApiSdk";
 *
 * function AdminIndexScreen() {
 *   return <AdminModelList baseUrl="/admin" api={api} />;
 * }
 * ```
 *
 * @see AdminModelTable for the table view that this navigates to
 * @see useAdminConfig for the configuration hook
 */
export const AdminModelList: React.FC<AdminModelListProps> = ({
  baseUrl,
  api,
  configurationPath,
}) => {
  const {config, isLoading, error} = useAdminConfig(api, baseUrl);

  const handlePress = useCallback(
    (modelName: string) => {
      router.push(`${baseUrl}/${modelName}` as any);
    },
    [baseUrl]
  );

  if (isLoading) {
    return (
      <Page maxWidth="100%" title="Admin">
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  if (error || !config) {
    return (
      <Page maxWidth="100%" title="Admin">
        <Box padding={4}>
          <Text color="error">Failed to load admin configuration.</Text>
        </Box>
      </Page>
    );
  }

  const scripts = config.scripts ?? [];
  const hasToolCards = scripts.length > 0 || !!configurationPath;

  return (
    <Page maxWidth="100%" scroll title="Admin">
      <Box gap={4} padding={4}>
        {hasToolCards && (
          <Box direction="row" gap={4} wrap>
            {scripts.length > 0 && (
              <ScriptsCard count={scripts.length} onPress={() => handlePress("__scripts")} />
            )}
            {configurationPath && (
              <ConfigurationCard onPress={() => router.push(configurationPath as any)} />
            )}
          </Box>
        )}
        <Box direction="row" gap={4} wrap>
          {config.models.map((model: AdminModelConfig) => (
            <ModelCard key={model.name} model={model} onPress={handlePress} />
          ))}
        </Box>
      </Box>
    </Page>
  );
};
