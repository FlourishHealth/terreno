import FontAwesome from "@expo/vector-icons/FontAwesome";
import {useFonts} from "expo-font";
import {Stack, useRouter, useSegments} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, {type FC, type ReactNode, useCallback, useEffect} from "react";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import "react-native-reanimated";
import {OpenFeatureProvider} from "@openfeature/react-sdk";
import {
  baseUrl,
  selectBetterAuthIsLoading,
  selectBetterAuthUserId,
  setRealtimeSocket,
  useRealtimeDebug,
  useSocketConnection,
  useTerrenoFeatureFlags,
  useUpgradeCheck,
} from "@terreno/rtk";
import {
  Banner,
  Box,
  ConsentNavigator,
  Spinner,
  TerrenoProvider,
  UpgradeRequiredScreen,
} from "@terreno/ui";
import {Provider, useSelector} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import type {ProfileData} from "@/hooks/useReadProfile";
import {getSessionToken} from "@/lib/betterAuth";
import store, {persistor, syncBetterAuthSession, useGetMeQuery} from "@/store";
import {terrenoApi} from "@/store/sdk";
import {setSyncDbReady, syncDb} from "@/store/syncdb";

const OpenFeatureBridge: FC<{
  children: ReactNode;
  socket: ReturnType<typeof useSocketConnection>["socket"];
}> = ({children, socket}) => {
  const bridgeUserId = useSelector(selectBetterAuthUserId) ?? undefined;
  useTerrenoFeatureFlags(terrenoApi, {
    skip: !bridgeUserId,
    socket,
    userId: bridgeUserId,
  });
  return <OpenFeatureProvider domain="feature-flags">{children}</OpenFeatureProvider>;
};

export {ErrorBoundary} from "expo-router";

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

  useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

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
  const userId = useSelector(selectBetterAuthUserId) ?? undefined;
  // The initial syncBetterAuthSession() call below is async (it awaits
  // authClient.getSession()), so userId is undefined for one or more render
  // passes on every fresh page load — including a deep link straight to a
  // route like /profile or /admin. Without gating on this flag, the auth
  // redirect effect below sees "no user yet" and replaces the URL with
  // /login before the session resolves, then bounces to the hardcoded
  // /(tabs) root once it does, silently discarding the originally requested
  // route.
  const isAuthLoading = useSelector(selectBetterAuthIsLoading);
  const {data: profileData, isLoading: isProfileLoading} = useGetMeQuery(undefined, {
    skip: !userId,
  });
  const profile = profileData as ProfileData | undefined;
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

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    return getSessionToken();
  }, []);

  const {socket} = useSocketConnection({
    baseUrl,
    getAuthToken,
    shouldConnect: Boolean(userId),
  });

  useRealtimeDebug(baseUrl, socket?.connected);

  useEffect(() => {
    setRealtimeSocket(socket);
    return (): void => {
      setRealtimeSocket(null);
    };
  }, [socket]);

  // Hydrate Better Auth session into Redux on startup.
  useEffect(() => {
    void syncBetterAuthSession(store.dispatch);
  }, []);

  // Start the local-first syncdb client after login; stop on logout/unmount.
  // setSyncDbReady only flips true once start() resolves a user, so screens gated on
  // useSyncDbReady() don't call mutate() during the window where it would throw.
  useEffect(() => {
    if (!userId) {
      return;
    }
    let stopped = false;
    syncDb
      .start()
      .then(() => {
        if (!stopped) {
          setSyncDbReady(true);
        }
      })
      .catch((error: unknown) => {
        console.error("[syncdb] Failed to start client", error);
      });
    return (): void => {
      if (stopped) {
        return;
      }
      stopped = true;
      setSyncDbReady(false);
      syncDb.stop().catch((error: unknown) => {
        console.warn("[syncdb] Failed to stop client", error);
      });
    };
  }, [userId]);

  useEffect(() => {
    // Don't redirect while the initial Better Auth session sync is still in
    // flight: userId is momentarily undefined on every fresh load (including
    // deep links to routes like /profile or /admin), and redirecting to
    // /login now would bounce straight back to the hardcoded /(tabs) root
    // once the session resolves, losing the originally requested route.
    if (isAuthLoading) {
      return;
    }

    const isOnAuthPage = segments[0] === "login" || segments[0] === "signup";

    if (!userId && !isOnAuthPage) {
      router.replace("/login");
    } else if (userId && isOnAuthPage) {
      router.replace("/(tabs)");
    }
  }, [userId, segments, router, isAuthLoading]);

  // Hold the navigator until the session (and, for signed-in users, the profile that
  // decides the ConsentNavigator wrapper below) has settled. The wrapper choice changes
  // the Stack's position in the React tree, and re-parenting unmounts and remounts the
  // Stack — a remounted Stack resets to initialRouteName "(tabs)", silently discarding
  // a deep-linked route like /profile or /admin. Rendering only once the tree shape is
  // final means the Stack mounts exactly once per auth state and keeps the requested URL.
  if (isAuthLoading || (Boolean(userId) && isProfileLoading)) {
    return (
      <Box alignItems="center" flex="grow" justifyContent="center" testID="app-auth-loading">
        <Spinner />
      </Box>
    );
  }

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
      <Stack.Screen name="syncdb-debug" options={{presentation: "modal"}} />
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
