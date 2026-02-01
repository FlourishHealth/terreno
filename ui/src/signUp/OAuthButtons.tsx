import type {FC} from "react";
import {View} from "react-native";

import {Box} from "../Box";
import {Button} from "../Button";
import {Text} from "../Text";
import {useTheme} from "../Theme";

import type {OAuthButtonsProps} from "./signUpTypes";

export const OAuthButtons: FC<OAuthButtonsProps> = ({
  providers,
  dividerText = "or continue with",
}) => {
  const {theme} = useTheme();

  const enabledProviders = providers.filter((p) => p.enabled);

  if (enabledProviders.length === 0) {
    return null;
  }

  return (
    <Box marginTop={6} width="100%">
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          marginBottom: 16,
          width: "100%",
        }}
      >
        <View
          style={{
            backgroundColor: theme.border.default,
            flex: 1,
            height: 1,
          }}
        />
        <Box paddingX={4}>
          <Text color="secondaryLight" size="sm">
            {dividerText}
          </Text>
        </Box>
        <View
          style={{
            backgroundColor: theme.border.default,
            flex: 1,
            height: 1,
          }}
        />
      </View>

      <Box gap={3}>
        {enabledProviders.map((provider) => (
          <Button
            fullWidth
            iconName={provider.iconName}
            key={provider.provider}
            onClick={provider.onPress ?? (() => {})}
            text={provider.label}
            variant="outline"
          />
        ))}
      </Box>
    </Box>
  );
};
