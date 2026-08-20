import {Box, Button, Card, Heading, Text} from "@terreno/ui";
import type {Href} from "expo-router";
import {router} from "expo-router";
import React, {useCallback} from "react";
import type {AdminHomeWidgetProps} from "../types";

export const FeatureFlagsOverridesWidget: React.FC<AdminHomeWidgetProps> = ({
  featureFlagModel,
  routeBase,
}) => {
  const onOpen = useCallback((): void => {
    if (!featureFlagModel) {
      return;
    }
    const prefix = routeBase.endsWith("/") ? routeBase.slice(0, -1) : routeBase;
    router.push(`${prefix}/${featureFlagModel.name}` as Href);
  }, [routeBase, featureFlagModel]);

  return (
    <Card padding={4} testID="admin-home-widget-feature-flags-overrides">
      <Heading size="sm">Feature flags</Heading>
      {featureFlagModel ? (
        <Box marginTop={2}>
          <Text color="secondaryDark" size="sm">
            Quick access to feature flag records.
          </Text>
          <Box marginTop={2}>
            <Button
              onClick={onOpen}
              text={`Open ${featureFlagModel.displayName}`}
              variant="outline"
            />
          </Box>
        </Box>
      ) : (
        <Box marginTop={2}>
          <Text color="secondaryDark" size="sm">
            No FeatureFlag model is registered in this admin config.
          </Text>
        </Box>
      )}
    </Card>
  );
};
