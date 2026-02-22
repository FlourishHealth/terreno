import {
  AIRequestExplorer,
  type AIRequestExplorerData,
  Box,
  Button,
  Card,
  Heading,
  Modal,
  Page,
  Spinner,
  Text,
  TextField,
  useStoredState,
} from "@terreno/ui";
import {useRouter} from "expo-router";
import type React from "react";
import {useCallback, useEffect, useState} from "react";
import {
  logout,
  useAppDispatch,
  useGetAiRequestsExplorerQuery,
  useGetMeQuery,
  usePatchMeMutation,
} from "@/store";

const EXPLORER_LIMIT = 20;

const ProfileScreen: React.FC = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const {data: profileResponse, isLoading, refetch} = useGetMeQuery();
  const [updateProfile, {isLoading: isUpdating}] = usePatchMeMutation();

  const profile = profileResponse?.data;
  const isAdmin = profile?.admin === true;

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

  // Admin explorer modal
  const [showExplorer, setShowExplorer] = useState<boolean>(false);
  const [explorerPage, setExplorerPage] = useState(1);
  const [requestTypeFilter, setRequestTypeFilter] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const {data: explorerData, isLoading: isExplorerLoading} = useGetAiRequestsExplorerQuery(
    {
      endDate: endDate || undefined,
      limit: EXPLORER_LIMIT,
      page: explorerPage,
      requestType: requestTypeFilter.length === 1 ? requestTypeFilter[0] : undefined,
      startDate: startDate || undefined,
    },
    {skip: !isAdmin || !showExplorer}
  );

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

  const handleOpenExplorer = useCallback((): void => {
    setShowExplorer(true);
  }, []);

  const handleCloseExplorer = useCallback((): void => {
    setShowExplorer(false);
  }, []);

  const handleExplorerPageChange = useCallback((newPage: number) => {
    setExplorerPage(newPage);
  }, []);

  const handleRequestTypeFilterChange = useCallback((types: string[]) => {
    setRequestTypeFilter(types);
    setExplorerPage(1);
  }, []);

  const handleStartDateChange = useCallback((date: string) => {
    setStartDate(date);
    setExplorerPage(1);
  }, []);

  const handleEndDateChange = useCallback((date: string) => {
    setEndDate(date);
    setExplorerPage(1);
  }, []);

  if (isLoading) {
    return (
      <Page navigation={undefined}>
        <Box alignItems="center" flex="grow" justifyContent="center">
          <Spinner />
        </Box>
      </Page>
    );
  }

  const explorerItems: AIRequestExplorerData[] = (explorerData?.data ?? []).map((item) => ({
    aiModel: item.aiModel,
    created: item.created,
    error: item.error,
    prompt: item.prompt,
    requestType: item.requestType,
    response: item.response,
    responseTime: item.responseTime,
    tokensUsed: item.tokensUsed,
    user: item.user,
  }));

  const explorerTotal = explorerData?.total ?? 0;
  const explorerTotalPages = Math.ceil(explorerTotal / EXPLORER_LIMIT);

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

        <Card marginBottom={6}>
          <Box gap={4}>
            <Heading size="lg">Session</Heading>
            <Text color="secondaryLight">Logged in as {profile?.email}</Text>
            <Button
              iconName="right-from-bracket"
              onClick={handleLogout}
              text="Logout"
              variant="destructive"
            />
          </Box>
        </Card>

        {isAdmin && (
          <Card>
            <Box gap={4}>
              <Heading size="lg">Admin</Heading>
              <Button
                iconName="chart-bar"
                onClick={handleOpenExplorer}
                text="View AI Requests"
                variant="secondary"
              />
              <Button
                iconName="gear"
                onClick={handleNavigateToAdmin}
                text="Admin Panel"
                variant="secondary"
              />
            </Box>
          </Card>
        )}
      </Box>

      <Modal
        onDismiss={handleCloseExplorer}
        size="lg"
        title="AI Request Explorer"
        visible={showExplorer}
      >
        <AIRequestExplorer
          data={explorerItems}
          endDate={endDate}
          isLoading={isExplorerLoading}
          onEndDateChange={handleEndDateChange}
          onPageChange={handleExplorerPageChange}
          onRequestTypeFilterChange={handleRequestTypeFilterChange}
          onStartDateChange={handleStartDateChange}
          page={explorerPage}
          requestTypeFilter={requestTypeFilter}
          startDate={startDate}
          testID="admin-explorer"
          totalCount={explorerTotal}
          totalPages={explorerTotalPages}
        />
      </Modal>
    </Page>
  );
};

export default ProfileScreen;
