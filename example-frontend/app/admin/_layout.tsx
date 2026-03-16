import {Stack} from "expo-router";
import type React from "react";

const AdminLayout: React.FC = () => {
  return (
    <Stack>
      <Stack.Screen name="index" options={{title: "Admin"}} />
      <Stack.Screen name="[model]" options={{headerShown: false}} />
      <Stack.Screen name="flags/index" options={{title: "Feature Flags"}} />
      <Stack.Screen name="flags/[key]" options={{title: "Flag Detail"}} />
    </Stack>
  );
};

export default AdminLayout;
