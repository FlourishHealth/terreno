import {customIcons} from "@components/customIcons";
import {TerrenoProvider} from "@terreno/ui";
import {Slot} from "expo-router";
import type React from "react";
import {GestureHandlerRootView} from "react-native-gesture-handler";

export const unstable_settings = {
  initialRouteName: process.env.NODE_ENV === "development" ? "dev" : "demo",
};

const RootLayout: React.FC = () => {
  // TODO: Store dev/demo in AsyncStorage to persist.
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <TerrenoProvider icons={customIcons}>
        <Slot />
      </TerrenoProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
