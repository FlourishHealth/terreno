import {
  defaultPasswordRequirements,
  type OAuthProviderConfig,
  type OnboardingPage,
  type SignUpFieldConfig,
  SignUpScreen,
} from "@terreno/ui";
import {useRouter} from "expo-router";
import type React from "react";
import {useCallback, useState} from "react";
import {useEmailSignUpMutation} from "@/store";

const signUpFields: SignUpFieldConfig[] = [
  {
    name: "name",
    placeholder: "Enter your name",
    required: true,
    title: "Name",
    type: "text",
  },
  {
    name: "email",
    placeholder: "Enter your email",
    required: true,
    title: "Email",
    type: "email",
  },
  {
    name: "password",
    placeholder: "Create a password",
    required: true,
    title: "Password",
    type: "password",
  },
];

const oauthProviders: OAuthProviderConfig[] = [
  {
    enabled: false,
    iconName: "google",
    label: "Continue with Google",
    provider: "google",
  },
  {
    enabled: false,
    iconName: "apple",
    label: "Continue with Apple",
    provider: "apple",
  },
];

const onboardingPages: OnboardingPage[] = [
  {
    header: "Welcome to Our App",
    id: "welcome",
    subheader: "Get started with the best experience",
  },
  {
    header: "Powerful Features",
    id: "features",
    subheader: "Discover all the tools at your fingertips",
  },
  {
    header: "You're All Set",
    id: "ready",
    subheader: "Create your account and start exploring",
  },
];

const SignUpScreenExample: React.FC = () => {
  const router = useRouter();
  const [emailSignUp, {isLoading, error}] = useEmailSignUpMutation();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const handleSubmit = useCallback(
    async (values: Record<string, string>): Promise<void> => {
      try {
        await emailSignUp({
          email: values.email,
          name: values.name,
          password: values.password,
        }).unwrap();
      } catch (err) {
        const apiError = err as {data?: {message?: string}};
        setErrorMessage(apiError?.data?.message || "An error occurred during sign up");
      }
    },
    [emailSignUp]
  );

  const handleLoginPress = useCallback((): void => {
    router.push("/login");
  }, [router]);

  return (
    <SignUpScreen
      error={errorMessage || (error as {data?: {message?: string}})?.data?.message}
      fields={signUpFields}
      isLoading={isLoading}
      loginLinkText="Already have an account? Log in"
      oauthDividerText="or continue with"
      oauthProviders={oauthProviders}
      onboardingPages={onboardingPages}
      onLoginPress={handleLoginPress}
      onSubmit={handleSubmit}
      passwordRequirements={{
        requirements: defaultPasswordRequirements,
        showCheckmarks: true,
        showOnFocus: true,
      }}
      showOnboardingFirst
      submitButtonText="Create Account"
    />
  );
};

export default SignUpScreenExample;
