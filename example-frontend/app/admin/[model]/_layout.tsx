import {Stack} from "expo-router";
import type React from "react";

const AdminModelLayout: React.FC = () => {
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{title: "Edit"}} />
      <Stack.Screen name="create" />
    </Stack>
  );
};

export default AdminModelLayout;
