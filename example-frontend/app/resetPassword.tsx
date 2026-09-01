import {Box, Button, Heading, Page, Text, TextField} from "@terreno/ui";
import {useLocalSearchParams, useRouter} from "expo-router";
import type React from "react";
import {useCallback, useMemo, useState} from "react";
import {parseAuthTokenFromRouteParam} from "@/lib/authRecoveryParams";
import {resetPasswordWithToken} from "@/lib/betterAuth";
import {useResetPasswordMutation} from "@/store/sdk";

const ResetPasswordScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{token?: string | string[]}>();
  const token = useMemo(
    (): string | undefined => parseAuthTokenFromRouteParam(params.token),
    [params.token]
  );
  const [password, setPassword] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [resetPassword] = useResetPasswordMutation();

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!token) {
      setErrorMessage(
        "This reset link is missing a token. Request a new email from the login page."
      );
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }
    setErrorMessage(undefined);
    setIsSubmitting(true);
    try {
      const betterAuthResult = await resetPasswordWithToken({newPassword: password, token});
      if (betterAuthResult.error) {
        await resetPassword({email: "", password, token}).unwrap();
      }
      setIsComplete(true);
    } catch (error: unknown) {
      console.error("[resetPassword] Reset failed", error);
      setErrorMessage(
        "This reset link is invalid or expired. Request a new one from the login page."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [password, resetPassword, token]);

  const handleBackToLogin = useCallback((): void => {
    router.replace("/login");
  }, [router]);

  return (
    <Page backButton navigation={undefined} scroll title="Reset password">
      <Box gap={4} padding={4} testID="reset-password-screen">
        {isComplete ? (
          <>
            <Heading size="lg">Password updated</Heading>
            <Text testID="reset-password-success">You can sign in with your new password.</Text>
            <Button
              onClick={handleBackToLogin}
              testID="reset-password-back-to-login"
              text="Back to login"
            />
          </>
        ) : (
          <>
            {!token ? (
              <Text color="error" testID="reset-password-missing-token">
                This reset link is missing a token. Request a new email from the login page.
              </Text>
            ) : null}
            <TextField
              onChange={setPassword}
              testID="reset-password-password"
              title="New password"
              type="password"
              value={password}
            />
            {errorMessage ? (
              <Text color="error" testID="reset-password-error">
                {errorMessage}
              </Text>
            ) : null}
            <Button
              disabled={!token || password.length < 6}
              loading={isSubmitting}
              onClick={handleSubmit}
              testID="reset-password-submit"
              text="Save new password"
            />
            <Button
              onClick={handleBackToLogin}
              testID="reset-password-login-link"
              text="Back to login"
              variant="ghost"
            />
          </>
        )}
      </Box>
    </Page>
  );
};

export default ResetPasswordScreen;
