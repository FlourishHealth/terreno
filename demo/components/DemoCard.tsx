import type {DemoConfiguration} from "@config";
import {Box, Heading, Text} from "@terreno/ui";
import type React from "react";
import {useCallback} from "react";
import {Pressable, StyleSheet, View} from "react-native";

const CARD_WIDTH = 300;
const CARD_HEIGHT = 280;
const CARD_PREVIEW_HEIGHT = 176;
const CARD_DIVIDER_HEIGHT = 4;
const CARD_TEXT_HEIGHT = 100;
const CARD_DESCRIPTION_LINES = 2;

// The press target is a sibling overlay rather than a wrapper so the card never nests a
// pressable inside a pressable. On web that would emit <button> inside <button>, which the
// HTML parser repairs by closing the outer button early and reparenting the rest of the grid
// onto <body>.
const styles = StyleSheet.create({
  pressTarget: {bottom: 0, left: 0, position: "absolute", right: 0, top: 0},
});

interface DemoCardProps {
  config: DemoConfiguration;
  onPress: (componentName: string) => void;
}

export const DemoCard: React.FC<DemoCardProps> = ({config, onPress}) => {
  const handlePress = useCallback((): void => {
    onPress(config.name);
  }, [config.name, onPress]);

  if (!config.name || !config.demo) {
    return null;
  }

  const homeTestId = `demo-home-${config.name.toLowerCase().replace(/\s+/g, "-")}`;

  return (
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
        position: "relative",
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
      <Pressable
        accessibilityHint={`Open the ${config.name} component demo.`}
        accessibilityLabel={`${config.name} demo card`}
        accessibilityRole="button"
        onPress={handlePress}
        style={styles.pressTarget}
        testID={homeTestId}
      />
    </View>
  );
};
