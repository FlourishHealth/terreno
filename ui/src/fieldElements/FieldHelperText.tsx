// This component is intended to be used as a helper text for form fields, specifically for text
// fields and text areas. It is not intended to be used as a standalone component.
import type {FC} from "react";
import {Text, View} from "react-native";

import {useTheme} from "../Theme";

interface FieldHelperTextProps {
  text: string;
}

export const FieldHelperText: FC<FieldHelperTextProps> = ({text}) => {
  const {theme} = useTheme();

  return (
    <View style={{marginTop: 2}}>
      <Text style={{color: theme.text.primary, fontSize: 12, lineHeight: 16}}>{text}</Text>
    </View>
  );
};
