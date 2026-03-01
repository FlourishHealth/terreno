import FontAwesome from "@expo/vector-icons/FontAwesome";
import {useFonts} from "expo-font";
import {Stack, useRouter, useSegments} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {useEffect} from "react";
import "react-native-reanimated";
import {baseUrl, getAuthToken, useSelectCurrentUserId, useSocketConnection, useSyncConnection} from "@terreno/rtk";
import {TerrenoProvider} from "@terreno/ui";
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import store, {logout, persistor, useAppDispatch} from "@/store";
import {terrenoApi} from "@/store/sdk";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.ReactElement | null {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
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
  const userId = useSelectCurrentUserId();
  const dispatch = useAppDispatch();
  const segments = useSegments();
  const router = useRouter();

  // Connect to WebSocket for real-time sync
  const {socket} = useSocketConnection({
    baseUrl,
    getAuthToken,
    shouldConnect: !!userId,
  });

  // Sync WebSocket events with RTK Query cache
  useSyncConnection({
    api: terrenoApi,
    socket,
    tagTypes: ["todos"],
  });

  // Validate stored auth token on mount
  useEffect(() => {
    if (!userId) {
      return;
    }
    const checkToken = async (): Promise<void> => {
      const token = await getAuthToken();
      if (!token) {
        dispatch(logout());
      }
    };
    void checkToken();
  }, [userId, dispatch]);

  // Redirect based on auth state — keeps all routes declared so refresh works
  useEffect(() => {
    const isOnLoginPage = segments[0] === "login";

    if (!userId && !isOnLoginPage) {
      router.replace("/login");
    } else if (userId && isOnLoginPage) {
      router.replace("/(tabs)");
    }
  }, [userId, segments, router]);

  return (
    <Stack screenOptions={{headerShown: false}}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
