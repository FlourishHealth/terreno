import {Box, Heading, SocialLoginButton, Text} from "@terreno/ui";
import type React from "react";
import {useCallback} from "react";

const handleDemoPress = async (): Promise<void> => {};

export const SocialLoginButtonDemo: React.FC = (): React.ReactElement => {
  const onPress = useCallback(handleDemoPress, []);

  return (
    <Box maxWidth={360} width="100%">
      <SocialLoginButton onPress={onPress} provider="google" testID="demo-social-login-google" />
    </Box>
  );
};

export const SocialLoginButtonProviders: React.FC = (): React.ReactElement => {
  const onPress = useCallback(handleDemoPress, []);

  return (
    <Box gap={3} maxWidth={360} width="100%">
      <Heading size="sm">Primary</Heading>
      <SocialLoginButton onPress={onPress} provider="google" variant="primary" />
      <SocialLoginButton onPress={onPress} provider="github" variant="primary" />
      <SocialLoginButton onPress={onPress} provider="apple" variant="primary" />
    </Box>
  );
};

export const SocialLoginButtonOutline: React.FC = (): React.ReactElement => {
  const onPress = useCallback(handleDemoPress, []);

  return (
    <Box gap={3} maxWidth={360} width="100%">
      <Heading size="sm">Outline</Heading>
      <SocialLoginButton onPress={onPress} provider="google" variant="outline" />
      <SocialLoginButton onPress={onPress} provider="github" variant="outline" />
      <SocialLoginButton onPress={onPress} provider="apple" variant="outline" />
    </Box>
  );
};

export const SocialLoginButtonStates: React.FC = (): React.ReactElement => {
  const onPress = useCallback(handleDemoPress, []);

  return (
    <Box gap={3} maxWidth={360} width="100%">
      <Heading size="sm">Loading and disabled</Heading>
      <Text>Loading shows a spinner. Disabled does not start OAuth.</Text>
      <SocialLoginButton loading onPress={onPress} provider="google" />
      <SocialLoginButton disabled onPress={onPress} provider="github" />
    </Box>
  );
};
