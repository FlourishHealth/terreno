import {TerrenoProvider} from "@terreno/ui";
import {Slot} from "expo-router";

const RootLayout = () => {
  // TODO: Store dev/demo in AsyncStorage to persist.
  return (
    <TerrenoProvider>
      <Slot initialRouteName={process.env.NODE_ENV === "development" ? "dev" : "demo"} />
    </TerrenoProvider>
  );
};

export default RootLayout;
