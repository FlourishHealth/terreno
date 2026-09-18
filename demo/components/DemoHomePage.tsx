import {DemoCard} from "@components/DemoCard";
import {DemoConfig} from "@config";
import {Box, Button, Heading, Text} from "@terreno/ui";
import {router, useNavigation} from "expo-router";
import type React from "react";
import {useEffect} from "react";
import {ScrollView} from "react-native";

import {DemoHomeBanner} from "./demoHomeBanner";

export const DemoHomePage: React.FC<{
  onPress: (componentName: string) => void;
}> = ({onPress}) => {
  const navigation = useNavigation();
  // Keep the browser title aligned with the demo index route.
  useEffect(() => {
    navigation.setOptions({title: "Terreno UI Demo"});
  }, [navigation]);

  return (
    <ScrollView
      contentContainerStyle={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        width: "100%",
      }}
      style={{padding: 20, width: "100%"}}
    >
      <Box
        alignItems="center"
        color="secondaryLight"
        direction="row"
        gap={4}
        justifyContent="between"
        margin={2}
        padding={4}
        rounding="md"
        testID="demo-home-palette-callout"
        width="100%"
        wrap
      >
        <Box flex="grow" gap={1} minWidth={220}>
          <Heading size="md">AI Palette Generator</Heading>
          <Text>
            Generate a full, WCAG-checked theme palette from a few colors or a prompt, then preview
            it on every component.
          </Text>
        </Box>
        <Button
          iconName="wand-magic-sparkles"
          onClick={() => router.navigate("/palette")}
          text="Open palette generator"
          variant="primary"
        />
      </Box>
      <DemoHomeBanner />
      {DemoConfig.map((config) => (
        <DemoCard config={config} key={config.name} onPress={onPress} />
      ))}
    </ScrollView>
  );
};
