import FontAwesome from "@expo/vector-icons/FontAwesome";
import {DarkTheme, DefaultTheme, ThemeProvider} from "@react-navigation/native";
import {useFonts} from "expo-font";
import {Stack} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {useEffect} from "react";
import "react-native-reanimated";
import {baseUrl, getAuthToken, useSelectCurrentUserId} from "@terreno/rtk";
import {TerrenoProvider} from "@terreno/ui";
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import {useColorScheme} from "@/components/useColorScheme";
import store, {logout, persistor, useAppDispatch} from "@/store";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading keeps the tabs visible
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.ReactElement | null {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
    // Terreno UI fonts (loaded locally to avoid bun symlink cache path issues in production builds)
    heading: require("../assets/fonts/TitilliumWeb_600SemiBold.ttf"),
    "heading-bold": require("../assets/fonts/TitilliumWeb_700Bold.ttf"),
    "heading-semibold": require("../assets/fonts/TitilliumWeb_600SemiBold.ttf"),
    text: require("../assets/fonts/Nunito_400Regular.ttf"),
    "text-bold": require("../assets/fonts/Nunito_700Bold.ttf"),
    "text-bold-italic": require("../assets/fonts/Nunito_700Bold_Italic.ttf"),
    "text-medium": require("../assets/fonts/Nunito_500Medium.ttf"),
    "text-medium-italic": require("../assets/fonts/Nunito_500Medium_Italic.ttf"),
    "text-regular": require("../assets/fonts/Nunito_400Regular.ttf"),
    "text-regular-italic": require("../assets/fonts/Nunito_400Regular_Italic.ttf"),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  // Hide splash screen once fonts are loaded
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <TerrenoProvider openAPISpecUrl={`${baseUrl}/openapi.json`}>
          <RootLayoutNav />
        </TerrenoProvider>
      </PersistGate>
    </Provider>
  );
}

function RootLayoutNav(): React.ReactElement {
  const colorScheme = useColorScheme();
  const userId = useSelectCurrentUserId();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!userId) {
      return;
    }
    const checkToken = async () => {
      const token = await getAuthToken();
      if (!token) {
        dispatch(logout());
      }
    };
    void checkToken();
  }, [userId, dispatch]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        {!userId ? (
          <Stack.Screen name="login" options={{headerShown: false}} />
        ) : (
          <Stack.Screen name="(tabs)" options={{headerShown: false}} />
        )}
      </Stack>
    </ThemeProvider>
  );
}
