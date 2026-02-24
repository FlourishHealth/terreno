import {Stack} from "expo-router";
import type React from "react";

const AdminLayout: React.FC = () => {
  return (
    <Stack>
      <Stack.Screen name="index" options={{title: "Admin"}} />
      <Stack.Screen name="[model]" options={{headerShown: false}} />
    </Stack>
  );
};

export default AdminLayout;
