import {Stack} from "expo-router";
import type React from "react";

const RootLayout: React.FC = () => {
  return <Stack screenOptions={{headerShown: false}} />;
};

export default RootLayout;
