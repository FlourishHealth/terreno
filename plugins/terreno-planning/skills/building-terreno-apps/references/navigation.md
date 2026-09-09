# Navigation — Terreno Apps

Terreno apps use Expo Router. Use Expo Router's public documentation for low-level APIs
such as `Link`, `Stack.Screen`, modals, and form sheets. This reference covers
Terreno-specific navigation patterns.

## Auth flow

1. Root `_layout.tsx` checks `useSelectCurrentUserId()` from `@terreno/rtk`.
2. Unauthenticated users redirect to `/login`.
3. Login screen calls `useEmailLoginMutation()` (from generated SDK via `generateAuthSlice`).
4. On success, tokens are stored automatically and `setUserId` is dispatched.
5. Root layout redirects to `/(tabs)` or the intended deep link.

```tsx
import {useEmailLoginMutation} from "@/store/sdk";
import {Button, TextField, Page, Box} from "@terreno/ui";

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [login, {isLoading, error}] = useEmailLoginMutation();

  const handleLogin = useCallback(async (): Promise<void> => {
    try {
      await login({email, password}).unwrap();
    } catch (err) {
      console.error("Login failed", err);
    }
  }, [email, login, password]);

  return (
    <Page title="Login" scroll>
      <Box gap={3} padding={4}>
        <TextField title="Email" value={email} onChange={setEmail} type="email" />
        <TextField title="Password" value={password} onChange={setPassword} type="password" />
        <Button text="Sign in" onClick={handleLogin} loading={isLoading} fullWidth />
      </Box>
    </Page>
  );
};
```

## Tabs

Use Expo Router tab groups. Set tab icons via `@expo/vector-icons` or FontAwesome through `@terreno/ui` `Icon`:

```tsx
import {Tabs} from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";

const TabLayout: React.FC = () => {
  return (
    <Tabs screenOptions={{headerShown: false}}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Todos",
          tabBarIcon: ({color}) => <FontAwesome name="list" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({color}) => <FontAwesome name="user" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
};
```

## Modals

Use Expo Router modal presentation for simple overlays:

```tsx
// app/_layout.tsx
<Stack>
  <Stack.Screen name="(tabs)" options={{headerShown: false}} />
  <Stack.Screen name="modal" options={{presentation: "modal"}} />
</Stack>
```

For confirmation dialogs and action sheets, prefer `@terreno/ui` `Modal` or `ActionSheet` — they render correctly on web and native.

## Deep linking

Configure `scheme` in `app.json`. Terreno RTK resolves API base URLs from `EXPO_PUBLIC_API_URL` or `expo.extra.BASE_URL` — keep deep link schemes separate from API URLs.

## Programmatic navigation

```tsx
import {useRouter} from "expo-router";

const router = useRouter();
router.push(`/admin/${modelName}`);
router.back();
```

Use `Link` from `expo-router` for declarative navigation when possible.
