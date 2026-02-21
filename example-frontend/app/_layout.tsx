import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  Nunito_400Regular,
  Nunito_400Regular_Italic,
  Nunito_500Medium,
  Nunito_500Medium_Italic,
  Nunito_700Bold,
  Nunito_700Bold_Italic,
} from "@expo-google-fonts/nunito";
import {TitilliumWeb_600SemiBold, TitilliumWeb_700Bold} from "@expo-google-fonts/titillium-web";
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
    heading: TitilliumWeb_600SemiBold,
    "heading-bold": TitilliumWeb_700Bold,
    "heading-semibold": TitilliumWeb_600SemiBold,
    // Terreno UI fonts
    text: Nunito_400Regular,
    "text-bold": Nunito_700Bold,
    "text-bold-italic": Nunito_700Bold_Italic,
    "text-medium": Nunito_500Medium,
    "text-medium-italic": Nunito_500Medium_Italic,
    "text-regular": Nunito_400Regular,
    "text-regular-italic": Nunito_400Regular_Italic,
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
