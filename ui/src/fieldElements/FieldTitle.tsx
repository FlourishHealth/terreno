// This component is intended to be used as a title for form fields,
// specifically for text fields and text areas. It is not intended to be used as a standalone
// component.
import type {FC} from "react";
import {Text} from "react-native";

import {isMobileDevice} from "../MediaQuery";
import {useTheme} from "../Theme";
import {isNative} from "../Utilities";

interface FieldTitleProps {
  text: string;
  testID?: string;
}

export const FieldTitle: FC<FieldTitleProps> = ({text, testID}) => {
  const {theme} = useTheme();
  const isMobileOrNative = isMobileDevice() || isNative();

  return (
    <Text
      style={{
        color: theme.text.primary,
        fontSize: isMobileOrNative ? 14 : 16,
        fontWeight: 600,
        lineHeight: 22.4,
      }}
      testID={testID}
    >
      {text}
    </Text>
  );
};
