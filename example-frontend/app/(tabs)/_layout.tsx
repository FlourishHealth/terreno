import FontAwesome from "@expo/vector-icons/FontAwesome";
import {Tabs} from "expo-router";
import type React from "react";
import {useColorScheme} from "@/components/useColorScheme";
import Colors from "@/constants/Colors";

const TabBarIcon: React.FC<{
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}> = ({name, color}) => {
  return <FontAwesome color={color} name={name} size={24} style={{marginBottom: -3}} />;
};

const TabLayout: React.FC = () => {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
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
        name="chat"
        options={{
          headerShown: false,
          tabBarIcon: ({color}) => <TabBarIcon color={color} name="comments" />,
          title: "AI Chat",
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          tabBarIcon: ({color}) => <TabBarIcon color={color} name="shield" />,
          title: "Admin",
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
