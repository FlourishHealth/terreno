import type {FC} from "react";

import {Box} from "../Box";
import {SocialLoginButton} from "../SocialLoginButton";
import {Text} from "../Text";
import type {OAuthProviderConfig} from "./signUpTypes";

interface OAuthButtonsProps {
  /** OAuth provider configurations. */
  providers: OAuthProviderConfig[];
  /** Whether all buttons should be disabled. */
  disabled?: boolean;
  /** Divider text displayed above the OAuth buttons. */
  dividerText?: string;
  /** Test ID prefix for the component. */
  testID?: string;
}

/**
 * Renders OAuth provider buttons with an optional divider text.
 * Uses SocialLoginButton for branded provider buttons.
 */
export const OAuthButtons: FC<OAuthButtonsProps> = ({
  providers,
  disabled = false,
  dividerText = "Or continue with",
  testID = "oauth-buttons",
}) => {
  if (providers.length === 0) {
    return null;
  }

  return (
    <Box testID={testID} width="100%">
      <Box alignItems="center" marginTop={6}>
        <Text color="secondaryLight">{dividerText}</Text>
      </Box>
      <Box gap={3} marginTop={4}>
        {providers.map((config) => (
          <SocialLoginButton
            disabled={disabled || config.disabled}
            key={config.provider}
            loading={config.loading}
            onPress={config.onPress}
            provider={config.provider}
            testID={`${testID}-${config.provider}`}
          />
        ))}
      </Box>
    </Box>
  );
};
