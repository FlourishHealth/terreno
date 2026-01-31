import {type FC, useCallback, useState} from "react";
import {Image, View} from "react-native";

import {Box} from "../Box";
import {Button} from "../Button";
import {Link} from "../Link";
import {Page} from "../Page";
import {Text} from "../Text";
import {TextField} from "../TextField";

import {OAuthButtons} from "./OAuthButtons";
import {PasswordRequirements} from "./PasswordRequirements";
import {Swiper} from "./Swiper";
import type {SignUpScreenProps} from "./signUpTypes";

export const SignUpScreen: FC<SignUpScreenProps> = ({
  logo,
  bannerComponent,
  fields,
  passwordRequirements,
  oauthProviders,
  oauthDividerText,
  onboardingPages,
  showOnboardingFirst = true,
  submitButtonText = "Sign Up",
  onSubmit,
  onLoginPress,
  loginLinkText = "Already have an account? Log in",
  isLoading = false,
  error,
}) => {
  const [showOnboarding, setShowOnboarding] = useState(
    showOnboardingFirst && Boolean(onboardingPages?.length)
  );
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleFieldChange = useCallback((name: string, value: string) => {
    setFormValues((prev) => ({...prev, [name]: value}));
    setFieldErrors((prev) => {
      const updated = {...prev};
      delete updated[name];
      return updated;
    });
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    for (const field of fields) {
      const value = formValues[field.name] || "";

      if (field.required && !value.trim()) {
        errors[field.name] = `${field.title} is required`;
        continue;
      }

      if (field.validate) {
        const error = field.validate(value, formValues);
        if (error) {
          errors[field.name] = error;
        }
      }
    }

    if (passwordRequirements) {
      const passwordField = fields.find((f) => f.type === "password");
      if (passwordField) {
        const password = formValues[passwordField.name] || "";
        const allRequirementsMet = passwordRequirements.requirements.every((req) =>
          req.validate(password)
        );
        if (!allRequirementsMet) {
          errors[passwordField.name] = "Password does not meet requirements";
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [fields, formValues, passwordRequirements]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }
    await onSubmit(formValues);
  }, [formValues, onSubmit, validateForm]);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  if (showOnboarding && onboardingPages && onboardingPages.length > 0) {
    return <Swiper onComplete={handleOnboardingComplete} pages={onboardingPages} />;
  }

  return (
    <Page navigation={undefined} scroll>
      <Box
        alignItems="center"
        alignSelf="center"
        flex="grow"
        justifyContent="center"
        maxWidth={400}
        padding={4}
        width="100%"
      >
        {Boolean(bannerComponent) && <Box marginBottom={6}>{bannerComponent}</Box>}

        {Boolean(logo) && !bannerComponent && (
          <Box alignItems="center" marginBottom={6}>
            <Image
              resizeMode="contain"
              source={logo!.source}
              style={{
                height: logo!.height || 80,
                width: logo!.width || 150,
              }}
            />
          </Box>
        )}

        <Box gap={4} width="100%">
          {fields.map((field) => {
            const isPasswordField = field.type === "password";

            return (
              <View key={field.name}>
                <TextField
                  disabled={isLoading}
                  errorText={fieldErrors[field.name]}
                  helperText={field.helperText}
                  onBlur={() => {
                    if (isPasswordField) {
                      setPasswordFocused(false);
                    }
                  }}
                  onChange={(value) => handleFieldChange(field.name, value)}
                  onFocus={() => {
                    if (isPasswordField) {
                      setPasswordFocused(true);
                    }
                  }}
                  placeholder={field.placeholder}
                  title={field.title}
                  type={field.type}
                  value={formValues[field.name] || ""}
                />
                {isPasswordField && passwordRequirements && (
                  <PasswordRequirements
                    password={formValues[field.name] || ""}
                    requirements={passwordRequirements.requirements}
                    showCheckmarks={passwordRequirements.showCheckmarks ?? true}
                    visible={passwordRequirements.showOnFocus ? passwordFocused : true}
                  />
                )}
              </View>
            );
          })}

          {Boolean(error) && <Text color="error">{error}</Text>}

          <Box marginTop={4}>
            <Button
              disabled={isLoading}
              fullWidth
              loading={isLoading}
              onClick={handleSubmit}
              text={submitButtonText}
              variant="primary"
            />
          </Box>

          {Boolean(oauthProviders?.length) && (
            <OAuthButtons dividerText={oauthDividerText} providers={oauthProviders!} />
          )}

          {Boolean(onLoginPress) && (
            <Box alignItems="center" marginTop={4}>
              <Link onClick={onLoginPress!} text={loginLinkText} />
            </Box>
          )}
        </Box>
      </Box>
    </Page>
  );
};
