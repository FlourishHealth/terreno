import {
  Box,
  Button,
  Heading,
  Page,
  SocialLoginButton,
  Text,
  TextField,
  useToast,
} from "@terreno/ui";
import {useRouter} from "expo-router";
import type React from "react";
import {useCallback, useState} from "react";
import {
  isBetterAuthEnabled,
  signInWithEmail,
  signInWithSocial,
  signUpWithEmail,
} from "@/lib/betterAuth";
import {useEmailLoginMutation, useEmailSignUpMutation} from "@/store";

const LoginScreen: React.FC = () => {
  const _router = useRouter();
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const toast = useToast();

  const useBetterAuth = isBetterAuthEnabled();

  const [emailLogin, {isLoading: isLoginLoading, error: loginError}] = useEmailLoginMutation();
  const [emailSignUp, {isLoading: isSignUpLoading, error: signUpError}] = useEmailSignUpMutation();

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!email || !password) {
      toast.warn("Email and password are required");
      return;
    }

    if (isSignUp && !name) {
      toast.warn("Signup requires name");
      return;
    }

    try {
      if (useBetterAuth) {
        // Use Better Auth for email/password auth
        if (isSignUp) {
          await signUpWithEmail(email, password, name);
        } else {
          await signInWithEmail(email, password);
        }
      } else {
        // Use traditional JWT auth
        if (isSignUp) {
          await emailSignUp({email, name, password}).unwrap();
        } else {
          await emailLogin({email, password}).unwrap();
        }
      }
      // Navigation will happen automatically when userId is set in the store
    } catch (err) {
      console.error("Authentication error:", err);
    }
  }, [email, password, name, isSignUp, emailLogin, emailSignUp, useBetterAuth, toast]);

  const handleSocialLogin = useCallback(
    async (provider: "google" | "github" | "apple"): Promise<void> => {
      setSocialLoading(provider);
      try {
        await signInWithSocial(provider);
        // Navigation will happen automatically when session is synced
      } catch (err) {
        console.error(`Social login error (${provider}):`, err);
        toast.error(`Failed to sign in with ${provider}`);
      } finally {
        setSocialLoading(null);
      }
    },
    [toast]
  );

  const toggleMode = useCallback((): void => {
    setIsSignUp(!isSignUp);
  }, [isSignUp]);

  const isLoading = isLoginLoading || isSignUpLoading || Boolean(socialLoading);
  const error = loginError || signUpError;

  const isSubmitDisabled = !email || !password || (isSignUp && !name) || isLoading;

  return (
    <Page navigation={undefined}>
      <Box
        alignItems="center"
        alignSelf="center"
        flex="grow"
        justifyContent="center"
        maxWidth={400}
        padding={4}
        width="100%"
      >
        <Box marginBottom={8}>
          <Heading>{isSignUp ? "Create Account" : "Welcome Back"}</Heading>
        </Box>
        <Box gap={4} width="100%">
          {isSignUp && (
            <TextField
              disabled={isLoading}
              onChange={setName}
              placeholder="Name"
              title="Name"
              value={name}
            />
          )}

          <TextField
            autoComplete="off"
            disabled={isLoading}
            onChange={setEmail}
            placeholder="Email"
            title="Email"
            type="email"
            value={email}
          />

          <TextField
            disabled={isLoading}
            onChange={setPassword}
            placeholder="Password"
            title="Password"
            type="password"
            value={password}
          />

          {Boolean(error) && (
            <Text color="error">
              {(error as {data?: {message?: string}})?.data?.message || "An error occurred"}
            </Text>
          )}

          <Box marginTop={4}>
            <Button
              disabled={isSubmitDisabled}
              fullWidth
              loading={isLoading}
              onClick={handleSubmit}
              text={isSignUp ? "Sign Up" : "Login"}
            />
          </Box>

          <Box marginTop={2}>
            <Button
              disabled={isLoading}
              fullWidth
              onClick={toggleMode}
              text={isSignUp ? "Already have an account? Login" : "Need an account? Sign Up"}
              variant="outline"
            />
          </Box>

          {useBetterAuth && !isSignUp && (
            <>
              <Box alignItems="center" marginTop={6}>
                <Text color="secondary">Or continue with</Text>
              </Box>

              <Box gap={3} marginTop={4}>
                <SocialLoginButton
                  disabled={isLoading}
                  loading={socialLoading === "google"}
                  onPress={() => handleSocialLogin("google")}
                  provider="google"
                />

                <SocialLoginButton
                  disabled={isLoading}
                  loading={socialLoading === "github"}
                  onPress={() => handleSocialLogin("github")}
                  provider="github"
                />

                <SocialLoginButton
                  disabled={isLoading}
                  loading={socialLoading === "apple"}
                  onPress={() => handleSocialLogin("apple")}
                  provider="apple"
                />
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Page>
  );
};

export default LoginScreen;
