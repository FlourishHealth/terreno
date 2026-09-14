import {Box, Button, Card, Heading, Text} from "@terreno/ui";
import type {Href} from "expo-router";
import {router} from "expo-router";
import React, {useCallback} from "react";
import type {AdminHomeWidgetProps} from "../types";

export const ScriptRunnerWidget: React.FC<AdminHomeWidgetProps> = ({routeBase}) => {
  const onScripts = useCallback((): void => {
    const prefix = routeBase.endsWith("/") ? routeBase.slice(0, -1) : routeBase;
    router.push(`${prefix}/__scripts` as Href);
  }, [routeBase]);

  return (
    <Card padding={4} testID="admin-home-widget-scriptRunner">
      <Heading size="sm">Scripts</Heading>
      <Box marginTop={1}>
        <Text color="secondaryDark" size="sm">
          Run registered admin maintenance scripts.
        </Text>
      </Box>
      <Box marginTop={2}>
        <Button onClick={onScripts} text="Open scripts" variant="primary" />
      </Box>
    </Card>
  );
};
