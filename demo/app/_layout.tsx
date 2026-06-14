import type React from "react";
import {TerrenoProvider} from "@terreno/ui";
import {Slot} from "expo-router";
import {GestureHandlerRootView} from "react-native-gesture-handler";

const RootLayout: React.FC = () => {
  // TODO: Store dev/demo in AsyncStorage to persist.
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <TerrenoProvider>
        <Slot initialRouteName={process.env.NODE_ENV === "development" ? "dev" : "demo"} />
      </TerrenoProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
