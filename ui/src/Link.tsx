import type React from "react";
import {Linking, Pressable} from "react-native";

import type {LinkProps} from "./Common";
import {Text} from "./Text";
import {pickTestId} from "./testing/resolveTestId";

export const Link: React.FC<LinkProps> = ({text, href, onClick, testId, testID}) => {
  const resolvedTestId = pickTestId({testID, testId});
  if (!href && !onClick) {
    console.error("Link component requires either href or onClick prop");
    return null;
  }
  return (
    <Pressable
      aria-role="button"
      hitSlop={20}
      onPress={() => {
        if (onClick) {
          onClick();
          return;
        }
        if (href) {
          void Linking.openURL(href);
        }
      }}
      testID={resolvedTestId}
    >
      <Text color="link" skipLinking underline>
        {text}
      </Text>
    </Pressable>
  );
};
