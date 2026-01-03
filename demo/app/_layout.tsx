import {FernsProvider} from "@terreno/ui";
import {Slot} from "expo-router";

const RootLayout = () => {
  // TODO: Store dev/demo in AsyncStorage to persist.
  return (
    <FernsProvider>
      <Slot initialRouteName={process.env.NODE_ENV === "development" ? "dev" : "demo"} />
    </FernsProvider>
  );
};

export default RootLayout;
