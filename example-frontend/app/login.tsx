import {baseUrl} from "@terreno/rtk";
import type {LoginScreenProps} from "@terreno/ui";
import {LoginScreen} from "@terreno/ui";
import {useRouter} from "expo-router";
import type React from "react";
import {useCallback, useMemo, useState} from "react";
import {betterAuthClient, signInWithSocial} from "@/lib/betterAuth";
import {syncBetterAuthSession, useAppDispatch} from "@/store/index";

const Login: React.FC = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (values: Record<string, string>): Promise<void> => {
      const {email, password} = values;
      setErrorMessage(undefined);
      setIsSubmitting(true);
      try {
        const result = await betterAuthClient.signIn.email({email, password});
        if (result.error) {
          setErrorMessage(result.error.message ?? "Sign in failed.");
          return;
        }
        await syncBetterAuthSession(dispatch);
        router.replace("/(tabs)");
      } catch (error: unknown) {
        // A thrown error here is a transport failure rather than rejected credentials
        // (those come back as result.error above), so log the cause: on native it is
        // usually an unreachable API base URL.
        console.error("[login] Email sign in threw", {baseUrl, error});
        setErrorMessage("Sign in failed. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [dispatch, router]
  );

  const handleSocialLogin = useCallback(
    async (provider: "google" | "github" | "apple"): Promise<void> => {
      setSocialLoading(provider);
      setErrorMessage(undefined);
      try {
        await signInWithSocial(provider);
        await syncBetterAuthSession(dispatch);
        router.replace("/(tabs)");
      } catch (error: unknown) {
        console.error("[login] Social sign in threw", {baseUrl, error, provider});
        setErrorMessage("Sign in failed. Please try again.");
      } finally {
        setSocialLoading(null);
      }
    },
    [dispatch, router]
  );

  const oauthProviders = useMemo((): LoginScreenProps["oauthProviders"] => {
    return (["google", "github", "apple"] as const).map((provider) => ({
      disabled: isSubmitting || Boolean(socialLoading),
      loading: socialLoading === provider,
      onPress: () => handleSocialLogin(provider),
      provider,
    }));
  }, [isSubmitting, socialLoading, handleSocialLogin]);

  const handleSignUpPress = useCallback((): void => {
    router.push("/signup");
  }, [router]);

  const handleForgotPassword = useCallback((): void => {
    router.push("/forgotPassword");
  }, [router]);

  const isLoading = isSubmitting || Boolean(socialLoading);

  return (
    <LoginScreen
      error={errorMessage}
      fields={[
        {autoComplete: "off", label: "Email", name: "email", required: true, type: "email"},
        {label: "Password", name: "password", required: true, type: "password"},
      ]}
      loading={isLoading}
      oauthProviders={oauthProviders}
      onForgotPassword={handleForgotPassword}
      onSignUpPress={handleSignUpPress}
      onSubmit={handleSubmit}
      testID="login-screen"
    />
  );
};

export default Login;
