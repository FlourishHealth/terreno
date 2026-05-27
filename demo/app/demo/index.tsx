import {DemoHomePage} from "@components";
import {Box} from "@terreno/ui";
import {router} from "expo-router";
import {Host} from "react-native-portalize";
import {useSafeAreaInsets} from "react-native-safe-area-context";

const App = () => {
  const insets = useSafeAreaInsets();

  // Update when we have new fonts picked, these look baaad.
  // const [loaded] = useFonts({
  //   "Comfortaa-Light": require("../../assets/Comfortaa-Light.ttf"),
  //   "Comfortaa-Bold": require("../../assets/Comfortaa-Bold.ttf"),
  //   IMFellEnglishSC: require("../../assets/IMFellEnglishSC-Regular.ttf"),
  //   "DancingScript-Regular": require("../../assets/DancingScript-Regular.ttf"),
  //   Cochin: require("../../assets/Cochin.ttf"),
  // });

  // if (!loaded) {
  //   return null;
  // }

  return (
    <Host>
      <Box
        style={{
          backgroundColor: "#fff",
          height: "100%",
          maxHeight: "100%",
          overflow: "hidden",
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingTop: insets.top,
          position: "absolute",
          width: "100%",
        }}
      >
        <Box
          direction="column"
          flex="grow"
          style={{
            backgroundColor: "#eee",
            maxHeight: "100%",
            overflow: "scroll",
            width: "100%",
          }}
        >
          <DemoHomePage
            onPress={(component: string) => {
              router.push(`demo/${encodeURIComponent(component)}`);
            }}
          />
        </Box>
      </Box>
    </Host>
  );
};

export default App;
