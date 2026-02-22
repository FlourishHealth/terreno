import FontAwesome from "@expo/vector-icons/FontAwesome";
import {useTheme} from "@terreno/ui";
import {Tabs} from "expo-router";
import type React from "react";

const TabBarIcon: React.FC<{
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}> = ({name, color}) => {
  return <FontAwesome color={color} name={name} size={24} style={{marginBottom: -3}} />;
};

const TabLayout: React.FC = () => {
  const {theme} = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.surface.primary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({color}) => <TabBarIcon color={color} name="list" />,
          title: "Todos",
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          headerShown: false,
          tabBarIcon: ({color}) => <TabBarIcon color={color} name="robot" />,
          title: "AI",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({color}) => <TabBarIcon color={color} name="user" />,
          title: "Profile",
        }}
      />
    </Tabs>
  );
};

export default TabLayout;
