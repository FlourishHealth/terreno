import {customIcons} from "@components";
import {TerrenoProvider} from "@terreno/ui";
import {Slot} from "expo-router";
import {GestureHandlerRootView} from "react-native-gesture-handler";

const RootLayout = () => {
  // TODO: Store dev/demo in AsyncStorage to persist.
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <TerrenoProvider icons={customIcons}>
        <Slot initialRouteName={process.env.NODE_ENV === "development" ? "dev" : "demo"} />
      </TerrenoProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
