import {DemoConfig, type DemoConfiguration} from "@config";
import {Box, Heading, Text} from "@terreno/ui";
import {useNavigation} from "expo-router";
import React, {useCallback, useEffect} from "react";
import {Pressable, ScrollView, View} from "react-native";

const CARD_WIDTH = 300;
const CARD_HEIGHT = 280;
const CARD_PREVIEW_HEIGHT = 176;
const CARD_DIVIDER_HEIGHT = 4;
const CARD_TEXT_HEIGHT = 100;
const CARD_DESCRIPTION_LINES = 2;

interface DemoCardProps {
  config: DemoConfiguration;
  onPress: (componentName: string) => void;
}

const DemoCard: React.FC<DemoCardProps> = ({config, onPress}) => {
  const handlePress = useCallback(async (): Promise<void> => {
    onPress(config.name);
  }, [config.name, onPress]);

  if (!config.name || !config.demo) {
    return null;
  }

  return (
    <Pressable
      accessibilityHint={`Open the ${config.name} component demo.`}
      accessibilityLabel={`${config.name} demo card`}
      onPress={handlePress}
    >
      <View
        style={{
          borderColor: "#ccc",
          borderRadius: 4,
          borderWidth: 1,
          height: CARD_HEIGHT,
          margin: 8,
          maxHeight: CARD_HEIGHT,
          maxWidth: CARD_WIDTH,
          minHeight: CARD_HEIGHT,
          overflow: "hidden",
          width: CARD_WIDTH,
        }}
      >
        <Box
          alignItems="center"
          color="neutralLight"
          display="flex"
          height={CARD_PREVIEW_HEIGHT}
          justifyContent="center"
          overflow="hidden"
          padding={4}
          width="100%"
        >
          {config.demo({preview: true})}
        </Box>
        <Box color="neutral" height={CARD_DIVIDER_HEIGHT} width="100%" />
        <Box color="base" height={CARD_TEXT_HEIGHT} padding={4} width="100%">
          <Box marginBottom={1}>
            <Heading size="sm">{config.name}</Heading>
          </Box>
          <Text numberOfLines={CARD_DESCRIPTION_LINES} size="sm">
            {config.shortDescription ?? config.description}
          </Text>
        </Box>
      </View>
    </Pressable>
  );
};

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
      {DemoConfig.map((config) => (
        <DemoCard config={config} key={config.name} onPress={onPress} />
      ))}
    </ScrollView>
  );
};
