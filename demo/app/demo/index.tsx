import {DemoHomePage} from "@components";
import {router} from "expo-router";
import {StyleSheet, View} from "react-native";
import {Host} from "react-native-portalize";
import {useSafeAreaInsets} from "react-native-safe-area-context";

export default function App() {
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
      <View
        style={{
          ...styles.container,
          backgroundColor: "#fff",
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingTop: insets.top,
          width: "100%",
        }}
      >
        <View style={styles.body}>
          <DemoHomePage
            onPress={(component: string) => {
              router.push(`demo/${component}`);
            }}
          />
        </View>
      </View>
    </Host>
  );
}

const styles = StyleSheet.create({
  body: {
    backgroundColor: "#eee",
    display: "flex",
    flex: 1,
    flexDirection: "column",
    maxHeight: "100%",
    overflow: "scroll",
    width: "100%",
  },
  container: {
    backgroundColor: "#fff",
    height: "100%",
    maxHeight: "100%",
    overflow: "hidden",
    position: "absolute",
    width: "100%",
  },
});
