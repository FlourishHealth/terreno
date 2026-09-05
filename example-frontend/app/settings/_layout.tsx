import {Stack} from "expo-router";
import type React from "react";

const SettingsLayout: React.FC = () => {
  return <Stack screenOptions={{headerShown: false}} />;
};

export default SettingsLayout;
