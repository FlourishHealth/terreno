import FontAwesome from "@expo/vector-icons/FontAwesome";
import {Link, Tabs} from "expo-router";
import type React from "react";
import {Pressable} from "react-native";
import {useClientOnlyValue} from "@/components/useClientOnlyValue";
import {useColorScheme} from "@/components/useColorScheme";
import Colors from "@/constants/Colors";

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={28} style={{marginBottom: -3}} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerRight: () => (
            <Link asChild href="/modal">
              <Pressable>
                {({pressed}) => (
                  <FontAwesome
                    color={Colors[colorScheme ?? "light"].text}
                    name="info-circle"
                    size={25}
                    style={{marginRight: 15, opacity: pressed ? 0.5 : 1}}
                  />
                )}
              </Pressable>
            </Link>
          ),
          tabBarIcon: ({color}) => <TabBarIcon color={color} name="code" />,
          title: "Tab One",
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          tabBarIcon: ({color}) => <TabBarIcon color={color} name="code" />,
          title: "Tab Two",
        }}
      />
    </Tabs>
  );
}
