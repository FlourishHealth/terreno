import {DemoConfig} from "@config";
import {Box, Heading, Text} from "@terreno/ui";
import {useNavigation} from "expo-router";
import {type FC, useEffect} from "react";
import {Pressable, ScrollView, View} from "react-native";

export const DemoHomePage: FC<{
  onPress: (componentName: string) => void;
}> = ({onPress}) => {
  const navigation = useNavigation();
  // Set the title
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
      testID="demo-home-screen"
    >
      {DemoConfig.map((c) => {
        if (!c.name || !c.demo) {
          return null;
        }
        const homeTestId = `demo-home-${c.name.toLowerCase().replace(/\s+/g, "-")}`;

        return (
          <Pressable
            accessibilityLabel={c.name}
            accessibilityRole="button"
            key={c.name}
            onPress={() => onPress(c.name)}
            testID={homeTestId}
          >
            <View
              style={{
                borderColor: "#ccc",
                borderRadius: 4,
                borderWidth: 1,
                flex: 1,
                height: 280,
                margin: 8,
                maxHeight: 280,
                maxWidth: 300,
                minHeight: 280,
                overflow: "hidden",
                padding: 16,
                width: 300,
              }}
            >
              <Box flex="grow" width="100%">
                {c.demo({preview: true})}
              </Box>
              <Box height={100} marginTop={4}>
                <Box marginBottom={1}>
                  <Heading size="sm">{c.name}</Heading>
                </Box>
                <Box>
                  <Text>{c.shortDescription ?? c.description}</Text>
                </Box>
              </Box>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};
