import FontAwesome from "@expo/vector-icons/FontAwesome";
import {useFonts} from "expo-font";
import {Stack, useRouter, useSegments} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, {type FC, type ReactNode, useEffect} from "react";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import "react-native-reanimated";
import {OpenFeatureProvider} from "@openfeature/react-sdk";
import {
  baseUrl,
  getAuthToken,
  setRealtimeSocket,
  useRealtimeDebug,
  useSelectCurrentUserId,
  useServerStatus,
  useSocketConnection,
  useTerrenoFeatureFlags,
  useUpgradeCheck,
} from "@terreno/rtk";
import {Banner, ConsentNavigator, TerrenoProvider, UpgradeRequiredScreen} from "@terreno/ui";
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import {useReadProfile} from "@/hooks/useReadProfile";
import {useSyncDbEnabled} from "@/hooks/useSyncDbEnabled";
import store, {logout, persistor, useAppDispatch} from "@/store";
import {terrenoApi} from "@/store/sdk";
import {syncDb} from "@/store/syncdb";

const OpenFeatureBridge: FC<{
  children: ReactNode;
  socket: ReturnType<typeof useSocketConnection>["socket"];
}> = ({children, socket}) => {
  const bridgeUserId = useSelectCurrentUserId();
  useTerrenoFeatureFlags(terrenoApi, {
    skip: !bridgeUserId,
    socket,
    userId: bridgeUserId,
  });
  return <OpenFeatureProvider domain="feature-flags">{children}</OpenFeatureProvider>;
};

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

const RootLayout = (): React.ReactElement | null => {
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
    <GestureHandlerRootView style={{flex: 1}}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <TerrenoProvider openAPISpecUrl={`${baseUrl}/openapi.json`}>
            <RootLayoutNav />
          </TerrenoProvider>
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
};

const RootLayoutNav = (): React.ReactElement => {
  const userId = useSelectCurrentUserId();
  const {isOnline} = useServerStatus({skip: !userId});
  const profile = useReadProfile();
  const dispatch = useAppDispatch();
  const segments = useSegments();
  const router = useRouter();
  const {
    canUpdate,
    isRequired,
    isWarning,
    onUpdate,
    requiredMessage,
    warningCheckCount,
    warningMessage,
  } = useUpgradeCheck({pollingIntervalMs: 300_000, recheckOnForeground: true});

  // Connect to WebSocket for real-time sync
  const {socket} = useSocketConnection({
    baseUrl,
    getAuthToken,
    shouldConnect: !!userId && isOnline,
  });

  // Sync frontend debug logging with backend debug.websocketsDebug (via /realtime/health)
  useRealtimeDebug(baseUrl, socket?.connected);

  // Provide socket to per-endpoint realtime handlers (realtimeList / realtimeDocument)
  useEffect(() => {
    setRealtimeSocket(socket);
    return (): void => {
      setRealtimeSocket(null);
    };
  }, [socket]);

  // Start the local-first syncdb client after login when the USE_SYNCDB flag is on;
  // stop it on logout/unmount. Wipe-on-user-change is handled inside the client.
  const syncDbEnabled = useSyncDbEnabled();
  useEffect(() => {
    if (!userId || !syncDbEnabled) {
      return;
    }
    let stopped = false;
    syncDb.start().catch((error: unknown) => {
      console.error("[syncdb] Failed to start client", error);
    });
    return (): void => {
      if (stopped) {
        return;
      }
      stopped = true;
      syncDb.stop().catch((error: unknown) => {
        console.warn("[syncdb] Failed to stop client", error);
      });
    };
  }, [userId, syncDbEnabled]);

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
    const isOnAuthPage = segments[0] === "login" || segments[0] === "signup";

    if (!userId && !isOnAuthPage) {
      router.replace("/login");
    } else if (userId && isOnAuthPage) {
      router.replace("/(tabs)");
    }
  }, [userId, segments, router]);

  if (isRequired) {
    return (
      <UpgradeRequiredScreen
        canUpdate={canUpdate}
        message={
          requiredMessage ?? "This version is no longer supported. Please update to continue."
        }
        onUpdate={onUpdate}
      />
    );
  }

  const warningBanner = isWarning ? (
    <Banner
      buttonOnClick={onUpdate}
      buttonText="Update"
      dismissible
      key={warningCheckCount}
      status="warning"
      text={warningMessage ?? "A new version is available. Please update for the best experience."}
    />
  ) : null;

  const stack = (
    <Stack screenOptions={{headerShown: false}}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );

  const content = (
    <>
      {warningBanner}
      {stack}
    </>
  );

  if (userId && !profile?.admin) {
    console.info("[RootLayout] Non-admin user, wrapping with ConsentNavigator", {
      admin: profile?.admin,
      profileLoaded: !!profile,
      userId,
    });
    return (
      <ConsentNavigator api={terrenoApi}>
        <OpenFeatureBridge socket={socket}>{content}</OpenFeatureBridge>
      </ConsentNavigator>
    );
  }

  console.debug("[RootLayout] Skipping ConsentNavigator", {
    admin: profile?.admin,
    profileLoaded: !!profile,
    userId: userId ?? "none",
  });
  return <OpenFeatureBridge socket={socket}>{content}</OpenFeatureBridge>;
};

export default RootLayout;
