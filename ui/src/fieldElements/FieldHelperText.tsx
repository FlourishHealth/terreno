// This component is intended to be used as a helper text for form fields, specifically for text
// fields and text areas. It is not intended to be used as a standalone component.
import type {FC} from "react";
import {Text, View} from "react-native";

import {useTheme} from "../Theme";
import {toTestProps} from "../testing/resolveTestId";

interface FieldHelperTextProps {
  text: string;
  testID?: string;
}

export const FieldHelperText: FC<FieldHelperTextProps> = ({text, testID}) => {
  const {theme} = useTheme();

  return (
    <View style={{alignSelf: "stretch", marginTop: 2, maxWidth: "100%"}} {...toTestProps(testID)}>
      <Text style={{color: theme.text.primary, flexShrink: 1, fontSize: 12, lineHeight: 16}}>
        {text}
      </Text>
    </View>
  );
};
