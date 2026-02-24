import type {SignUpScreenProps} from "@terreno/ui";
import {SignUpScreen, simplePasswordRequirements} from "@terreno/ui";
import {useRouter} from "expo-router";
import type React from "react";
import {useCallback, useMemo, useState} from "react";
import {isBetterAuthEnabled, signInWithSocial, signUpWithEmail} from "@/lib/betterAuth";
import {useEmailSignUpMutation} from "@/store";

const SignUp: React.FC = () => {
  const router = useRouter();
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const useBetterAuth = isBetterAuthEnabled();

  const [emailSignUp, {isLoading: isSignUpLoading, error: signUpError}] = useEmailSignUpMutation();

  const handleSubmit = useCallback(
    async (values: Record<string, string>): Promise<void> => {
      const {email, password, name} = values;
      if (useBetterAuth) {
        await signUpWithEmail(email, password, name);
      } else {
        await emailSignUp({email, name, password}).unwrap();
      }
    },
    [emailSignUp, useBetterAuth]
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

  const oauthProviders = useMemo((): SignUpScreenProps["oauthProviders"] => {
    if (!useBetterAuth) {
      return undefined;
    }
    return (["google", "github", "apple"] as const).map((provider) => ({
      disabled: isSignUpLoading || Boolean(socialLoading),
      loading: socialLoading === provider,
      onPress: () => handleSocialLogin(provider),
      provider,
    }));
  }, [useBetterAuth, isSignUpLoading, socialLoading, handleSocialLogin]);

  const isLoading = isSignUpLoading || Boolean(socialLoading);
  const errorMessage = signUpError
    ? (signUpError as {data?: {message?: string}})?.data?.message || "An error occurred"
    : undefined;

  return (
    <SignUpScreen
      error={errorMessage}
      fields={[
        {label: "Name", name: "name", required: true, type: "text"},
        {autoComplete: "off", label: "Email", name: "email", required: true, type: "email"},
        {label: "Password", name: "password", required: true, type: "password"},
      ]}
      loading={isLoading}
      oauthProviders={oauthProviders}
      onLoginPress={() => router.back()}
      onSubmit={handleSubmit}
      passwordRequirements={simplePasswordRequirements}
      testID="signup-screen"
    />
  );
};

export default SignUp;
