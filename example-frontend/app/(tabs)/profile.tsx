import {useFeatureFlags} from "@terreno/rtk";
import {
  Box,
  Button,
  Card,
  Heading,
  Page,
  Spinner,
  Text,
  TextField,
  useStoredState,
  useTheme,
} from "@terreno/ui";
import {useRouter} from "expo-router";
import type React from "react";
import {useCallback, useEffect, useMemo, useState} from "react";
import {logout, terrenoApi, useAppDispatch, useGetMeQuery, usePatchMeMutation} from "@/store";

const ProfileScreen: React.FC = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const {data: profileResponse, isLoading, refetch} = useGetMeQuery();
  const [updateProfile, {isLoading: isUpdating}] = usePatchMeMutation();
  const {setPrimitives, resetTheme} = useTheme();

  const {
    flags,
    getFlag,
    isLoading: isFeatureFlagsLoading,
    error: featureFlagsError,
  } = useFeatureFlags(terrenoApi);
  const showDarkModeToggle = getFlag("dark-mode-toggle");
  const featureFlagEntries = useMemo(
    (): Array<{key: string; value: boolean | string | null}> =>
      Object.keys(flags)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => ({key, value: flags[key]})),
    [flags]
  );

  const profile = profileResponse?.data;

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // API key management
  const [geminiApiKey, setGeminiApiKey] = useStoredState<string>("geminiApiKey", "");
  const [apiKeyInput, setApiKeyInput] = useState<string>("");
  const [apiKeySaved, setApiKeySaved] = useState<boolean>(false);

  // Initialize form with profile data when loaded
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setEmail(profile.email || "");
    }
  }, [profile]);

  // Sync API key input with stored value
  useEffect(() => {
    if (geminiApiKey) {
      setApiKeyInput(geminiApiKey);
    }
  }, [geminiApiKey]);

  // Track changes
  useEffect(() => {
    if (!profile) {
      return;
    }
    const nameChanged = name !== (profile.name || "");
    const emailChanged = email !== (profile.email || "");
    const passwordChanged = password.length > 0;
    setHasChanges(nameChanged || emailChanged || passwordChanged);
  }, [name, email, password, profile]);

  const handleSave = useCallback(async (): Promise<void> => {
    setSaveError(null);
    setSaveSuccess(false);

    const updates: {name?: string; email?: string; password?: string} = {};

    if (name !== profile?.name) {
      updates.name = name;
    }
    if (email !== profile?.email) {
      updates.email = email;
    }
    if (password) {
      updates.password = password;
    }

    try {
      await updateProfile(updates).unwrap();
      setSaveSuccess(true);
      setPassword("");
      refetch();
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Error updating profile:", err);
      setSaveError(
        (err as {data?: {message?: string}})?.data?.message || "Failed to update profile"
      );
    }
  }, [name, email, password, profile, updateProfile, refetch]);

  const handleLogout = useCallback((): void => {
    dispatch(logout());
  }, [dispatch]);

  const handleSaveApiKey = useCallback((): void => {
    setGeminiApiKey(apiKeyInput.trim());
    setApiKeySaved(true);
    setTimeout(() => {
      setApiKeySaved(false);
    }, 3000);
  }, [apiKeyInput, setGeminiApiKey]);

  const handleClearApiKey = useCallback((): void => {
    setGeminiApiKey("");
    setApiKeyInput("");
    setApiKeySaved(false);
  }, [setGeminiApiKey]);

  const handleNavigateToAdmin = useCallback((): void => {
    router.push("/admin");
  }, [router]);

  if (isLoading) {
    return (
      <Page navigation={undefined}>
        <Box alignItems="center" flex="grow" justifyContent="center">
          <Spinner />
        </Box>
      </Page>
    );
  }

  return (
    <Page navigation={undefined} scroll>
      <Box padding={4}>
        <Box marginBottom={6}>
          <Heading size="xl">Profile</Heading>
        </Box>

        <Card marginBottom={6}>
          <Box gap={4}>
            <Heading size="lg">Account Details</Heading>

            <TextField
              disabled={isUpdating}
              onChange={setName}
              placeholder="Your name"
              title="Name"
              value={name}
            />

            <TextField
              autoComplete="off"
              disabled={isUpdating}
              onChange={setEmail}
              placeholder="your@email.com"
              title="Email"
              type="email"
              value={email}
            />

            <TextField
              disabled={isUpdating}
              onChange={setPassword}
              placeholder="Leave blank to keep current password"
              title="New Password"
              type="password"
              value={password}
            />

            {saveSuccess && (
              <Box>
                <Text color="success">Profile updated successfully!</Text>
              </Box>
            )}

            {saveError && (
              <Box>
                <Text color="error">{saveError}</Text>
              </Box>
            )}

            <Box marginTop={2}>
              <Button
                disabled={!hasChanges || isUpdating}
                iconName="check"
                loading={isUpdating}
                onClick={handleSave}
                text="Save Changes"
              />
            </Box>
          </Box>
        </Card>

        <Card marginBottom={6}>
          <Box gap={4}>
            <Heading size="lg">Gemini API Key</Heading>
            <Text color="secondaryLight" size="sm">
              Paste your Gemini API key to enable AI features. The key is stored locally on your
              device.
            </Text>
            <TextField
              onChange={setApiKeyInput}
              placeholder="Enter your Gemini API key"
              title="API Key"
              type="password"
              value={apiKeyInput}
            />
            {apiKeySaved && (
              <Box>
                <Text color="success">API key saved!</Text>
              </Box>
            )}
            <Box direction="row" gap={2}>
              <Button
                disabled={!apiKeyInput.trim()}
                iconName="check"
                onClick={handleSaveApiKey}
                text="Save Key"
              />
              <Button
                disabled={!geminiApiKey}
                iconName="trash"
                onClick={handleClearApiKey}
                text="Clear Key"
                variant="destructive"
              />
            </Box>
          </Box>
        </Card>

        {/* Dark mode toggle — gated by "dark-mode-toggle" feature flag */}
        {showDarkModeToggle && (
          <Card marginBottom={6} testID="profile-dark-mode-card">
            <Box gap={4}>
              <Heading size="lg">Appearance</Heading>
              <Box direction="row" gap={3}>
                <Button
                  iconName="sun"
                  onClick={() => resetTheme()}
                  text="Light"
                  variant="outline"
                />
                <Button
                  iconName="moon"
                  onClick={() =>
                    setPrimitives({
                      neutral000: "#1a1a2e",
                      neutral100: "#16213e",
                      neutral200: "#0f3460",
                      neutral800: "#e0e0e0",
                      neutral900: "#ffffff",
                    })
                  }
                  text="Dark"
                  variant="outline"
                />
              </Box>
            </Box>
          </Card>
        )}

        <Card marginBottom={6} testID="profile-feature-flags-card">
          <Box gap={3}>
            <Heading size="lg">Feature Flags</Heading>
            {isFeatureFlagsLoading && <Text color="secondaryLight">Loading feature flags...</Text>}
            {!isFeatureFlagsLoading && featureFlagsError && (
              <Text color="error">Failed to load feature flags</Text>
            )}
            {!isFeatureFlagsLoading && !featureFlagsError && featureFlagEntries.length === 0 && (
              <Text color="secondaryLight">No feature flags evaluated for this user.</Text>
            )}
            {!isFeatureFlagsLoading &&
              !featureFlagsError &&
              featureFlagEntries.map((flagEntry) => (
                <Box
                  alignItems="center"
                  direction="row"
                  justifyContent="between"
                  key={flagEntry.key}
                  paddingY={1}
                >
                  <Text>{flagEntry.key}</Text>
                  <Text color="secondaryLight">{String(flagEntry.value)}</Text>
                </Box>
              ))}
          </Box>
        </Card>

        <Card marginBottom={6}>
          <Box gap={4}>
            <Heading size="lg">Session</Heading>
            <Text color="secondaryLight">Logged in as {profile?.email}</Text>
            <Button
              iconName="right-from-bracket"
              onClick={handleLogout}
              testID="profile-logout-button"
              text="Logout"
              variant="destructive"
            />
          </Box>
        </Card>

        <Card marginBottom={6}>
          <Box gap={4}>
            <Heading size="lg">Developer</Heading>
            <Button
              iconName="gear"
              onClick={handleNavigateToAdmin}
              text="Admin Panel"
              variant="secondary"
            />
          </Box>
        </Card>
      </Box>
    </Page>
  );
};

export default ProfileScreen;
