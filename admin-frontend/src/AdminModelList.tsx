import type {Api} from "@reduxjs/toolkit/query/react";
import {Box, Card, Heading, Page, Spinner, Text} from "@terreno/ui";
import {router} from "expo-router";
import React, {useCallback} from "react";
import type {AdminModelConfig} from "./types";
import {useAdminConfig} from "./useAdminConfig";

interface AdminModelListProps {
  baseUrl: string;
  api: Api<any, any, any, any>;
}

export const AdminModelList: React.FC<AdminModelListProps> = ({baseUrl, api}) => {
  const {config, isLoading, error} = useAdminConfig(api, baseUrl);

  const handlePress = useCallback((modelName: string) => {
    router.push(`./${modelName}`);
  }, []);

  if (isLoading) {
    return (
      <Page navigation={null} title="Admin">
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  if (error || !config) {
    return (
      <Page navigation={null} title="Admin">
        <Box padding={4}>
          <Text color="error">Failed to load admin configuration.</Text>
        </Box>
      </Page>
    );
  }

  return (
    <Page navigation={null} scroll title="Admin">
      <Box direction="row" gap={4} padding={4} wrap>
        {config.models.map((model: AdminModelConfig) => {
          const fieldCount = Object.keys(model.fields).length;
          return (
            <Card key={model.name} padding={4} testID={`admin-model-card-${model.name}`}>
              <Box
                accessibilityHint={`Navigate to ${model.displayName} admin`}
                accessibilityLabel={model.displayName}
                gap={2}
                onClick={() => handlePress(model.name)}
                width={240}
              >
                <Heading size="md">{model.displayName}</Heading>
                <Text color="secondaryDark" size="sm">
                  {fieldCount} field{fieldCount !== 1 ? "s" : ""}
                </Text>
              </Box>
            </Card>
          );
        })}
      </Box>
    </Page>
  );
};
