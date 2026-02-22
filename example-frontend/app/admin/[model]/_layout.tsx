import {Stack} from "expo-router";
import type React from "react";

const AdminModelLayout: React.FC = () => {
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="create" />
    </Stack>
  );
};

export default AdminModelLayout;
