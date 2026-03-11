import type {FC} from "react";
import {useCallback, useState} from "react";

import {Box} from "../Box";
import {Button} from "../Button";
import {Heading} from "../Heading";
import {Page} from "../Page";
import {OAuthButtons} from "../signUp/OAuthButtons";
import {Text} from "../Text";
import {TextField} from "../TextField";
import type {LoginScreenProps} from "./loginTypes";

/**
 * A configurable login screen component with support for custom fields,
 * OAuth providers, sign-up link, and forgot password link.
 *
 * @example
 * ```tsx
 * <LoginScreen
 *   fields={[
 *     {name: "email", label: "Email", type: "email", required: true},
 *     {name: "password", label: "Password", type: "password", required: true},
 *   ]}
 *   onSubmit={async (values) => {
 *     await signIn(values.email, values.password);
 *   }}
 *   oauthProviders={[
 *     {provider: "google", onPress: () => signInWithSocial("google")},
 *   ]}
 *   onSignUpPress={() => router.push("/signup")}
 *   onForgotPasswordPress={() => router.push("/forgot-password")}
 * />
 * ```
 */
export const LoginScreen: FC<LoginScreenProps> = ({
  fields,
  onSubmit,
  oauthProviders,
  logo,
  title = "Welcome Back",
  loading = false,
  error,
  signUpLinkText = "Need an account? Sign Up",
  onSignUpPress,
  forgotPasswordText = "Forgot password?",
  onForgotPasswordPress,
  testID = "login-screen",
}) => {
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of fields) {
      initial[field.name] = "";
    }
    return initial;
  });

  const handleFieldChange = useCallback((fieldName: string, value: string) => {
    setFormValues((prev) => ({...prev, [fieldName]: value}));
  }, []);

  const handleSubmit = useCallback(async () => {
    await onSubmit(formValues);
  }, [formValues, onSubmit]);

  const requiredFieldsFilled = fields
    .filter((f) => f.required)
    .every((f) => (formValues[f.name] ?? "").trim().length > 0);

  const isSubmitDisabled = loading || !requiredFieldsFilled;

  return (
    <Page navigation={undefined}>
      <Box
        alignItems="center"
        alignSelf="center"
        flex="grow"
        justifyContent="center"
        maxWidth={400}
        padding={4}
        testID={testID}
        width="100%"
      >
        {Boolean(logo) && <Box marginBottom={6}>{logo}</Box>}

        <Box marginBottom={8}>
          <Heading testID={`${testID}-title`}>{title}</Heading>
        </Box>

        <Box gap={4} width="100%">
          {fields.map((field) => (
            <TextField
              autoComplete={field.autoComplete}
              disabled={loading}
              key={field.name}
              onChange={(value: string) => handleFieldChange(field.name, value)}
              placeholder={field.placeholder ?? field.label}
              testID={`${testID}-${field.name}-input`}
              title={field.label}
              type={
                field.type === "email" ? "email" : field.type === "password" ? "password" : "text"
              }
              value={formValues[field.name]}
            />
          ))}

          {Boolean(error) && (
            <Text color="error" testID={`${testID}-error`}>
              {error}
            </Text>
          )}

          <Box marginTop={4}>
            <Button
              disabled={isSubmitDisabled}
              fullWidth
              loading={loading}
              onClick={handleSubmit}
              testID={`${testID}-submit-button`}
              text="Log In"
            />
          </Box>

          {Boolean(onForgotPasswordPress) && (
            <Box alignItems="center" marginTop={2}>
              <Button
                disabled={loading}
                onClick={onForgotPasswordPress!}
                testID={`${testID}-forgot-password`}
                text={forgotPasswordText!}
                variant="muted"
              />
            </Box>
          )}

          {Boolean(onSignUpPress) && (
            <Box marginTop={2}>
              <Button
                disabled={loading}
                fullWidth
                onClick={onSignUpPress!}
                testID={`${testID}-signup-link`}
                text={signUpLinkText!}
                variant="outline"
              />
            </Box>
          )}

          {Boolean(oauthProviders && oauthProviders.length > 0) && (
            <OAuthButtons
              disabled={loading}
              providers={oauthProviders!}
              testID={`${testID}-oauth`}
            />
          )}
        </Box>
      </Box>
    </Page>
  );
};
