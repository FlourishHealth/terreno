import type {LoginScreenProps} from "@terreno/ui";
import {LoginScreen} from "@terreno/ui";
import {useRouter} from "expo-router";
import type React from "react";
import {useCallback, useMemo, useState} from "react";
import {isBetterAuthEnabled, signInWithEmail, signInWithSocial} from "@/lib/betterAuth";
import {useEmailLoginMutation} from "@/store";

const Login: React.FC = () => {
  const router = useRouter();
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const useBetterAuth = isBetterAuthEnabled();

  const [emailLogin, {isLoading: isLoginLoading, error: loginError}] = useEmailLoginMutation();

  const handleSubmit = useCallback(
    async (values: Record<string, string>): Promise<void> => {
      const {email, password} = values;
      if (useBetterAuth) {
        await signInWithEmail(email, password);
      } else {
        await emailLogin({email, password}).unwrap();
      }
    },
    [emailLogin, useBetterAuth]
  );

  const handleSocialLogin = useCallback(
    async (provider: "google" | "github" | "apple"): Promise<void> => {
      setSocialLoading(provider);
      try {
        await signInWithSocial(provider);
      } finally {
        setSocialLoading(null);
      }
    },
    []
  );

  const oauthProviders = useMemo((): LoginScreenProps["oauthProviders"] => {
    if (!useBetterAuth) {
      return undefined;
    }
    return (["google", "github", "apple"] as const).map((provider) => ({
      disabled: isLoginLoading || Boolean(socialLoading),
      loading: socialLoading === provider,
      onPress: () => handleSocialLogin(provider),
      provider,
    }));
  }, [useBetterAuth, isLoginLoading, socialLoading, handleSocialLogin]);

  const isLoading = isLoginLoading || Boolean(socialLoading);
  const errorMessage = loginError
    ? (loginError as {data?: {message?: string}})?.data?.message || "An error occurred"
    : undefined;

  return (
    <LoginScreen
      error={errorMessage}
      fields={[
        {autoComplete: "off", label: "Email", name: "email", required: true, type: "email"},
        {label: "Password", name: "password", required: true, type: "password"},
      ]}
      loading={isLoading}
      oauthProviders={oauthProviders}
      onSignUpPress={() => router.push("/signup")}
      onSubmit={handleSubmit}
      testID="login-screen"
    />
  );
};

export default Login;
