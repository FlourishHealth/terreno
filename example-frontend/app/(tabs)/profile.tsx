import {Box, Button, Card, Heading, Page, Spinner, Text, TextField} from "@terreno/ui";
import {useRouter} from "expo-router";
import type React from "react";
import {useCallback, useEffect, useState} from "react";
import {logout, useAppDispatch, useGetMeQuery, usePatchMeMutation} from "@/store";

const ProfileScreen: React.FC = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const {data: profileResponse, isLoading, refetch} = useGetMeQuery();
  const [updateProfile, {isLoading: isUpdating}] = usePatchMeMutation();

  const profile = profileResponse?.data;

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize form with profile data when loaded
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setEmail(profile.email || "");
    }
  }, [profile]);

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
      // Refetch to get updated profile
      refetch();
      // Clear success message after 3 seconds
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

        <Card>
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
