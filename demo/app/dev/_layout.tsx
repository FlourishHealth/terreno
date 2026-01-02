import {router, Stack} from "expo-router";
import {StatusBar} from "expo-status-bar";
import {isMobileDevice} from "@terreno/ui";
import {Pressable, StyleSheet, Text} from "react-native";

export default function Layout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerBackVisible: isMobileDevice(),
          headerRight: () => (
            <Pressable
              onPress={async () => {
                router.navigate("demo");
              }}
              style={styles.header}
            >
              <Text style={{fontWeight: "bold"}}>Demo Mode</Text>
            </Pressable>
          ),
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    marginRight: isMobileDevice() ? 0 : 16,
  },
});
