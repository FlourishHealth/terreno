import type {ReactElement} from "react";
import {Image, View} from "react-native";

import type {SignatureFieldProps} from "./Common";
import {Heading} from "./Heading";
import {Icon} from "./Icon";
import {Signature} from "./Signature";
import {Text} from "./Text";
import {useTheme} from "./Theme";

// NOTE: When using this inside a ScrollView, you must set the scrollEnabled prop to false on the
// ScrollView onStart and to true onEnd or it will try to scroll the whole view around this
// component.
export const SignatureField = ({
  disabled = false,
  title = "Signature",
  value,
  onChange,
  onStart,
  onEnd,
  disabledText,
  errorText,
}: SignatureFieldProps): ReactElement => {
  const {theme} = useTheme();
  if (disabled) {
    if (value) {
      return (
        <View>
          <Heading size="sm">{title}</Heading>
          <View style={{marginVertical: 8}}>{SignatureImage(value)}</View>
          <Text size="sm">{disabledText}</Text>
        </View>
      );
    } else {
      // we don't have a value so should show a grayed out signature field as a box
      // there is no disabled state for the Signature components
      return (
        <View>
          <View
            style={{
              backgroundColor: theme.surface.neutralLight,
              height: 90,
              marginVertical: 8,
              width: 300,
            }}
          />
          <Text size="sm">{disabledText}</Text>
        </View>
      );
    }
  }
  return (
    <View>
      <Heading size="sm">{title}</Heading>
      {Boolean(errorText) && (
        <View style={{flexDirection: "row"}}>
          <Icon color="error" iconName="triangle-exclamation" />
          <View style={{marginLeft: 4}}>
            <Text color="error">{errorText}</Text>
          </View>
        </View>
      )}
      <View style={{marginVertical: 8}}>
        <Signature
          onChange={onChange}
          onEnd={() => {
            onEnd?.();
          }}
          onStart={() => {
            onStart?.();
          }}
        />
      </View>
    </View>
  );
};

const SignatureImage = (image: string): ReactElement => {
  return (
    <Image
      accessibilityIgnoresInvertColors={false}
      resizeMode="contain"
      source={{uri: image}}
      style={{
        borderColor: "black",
        borderWidth: 1,
        height: 80,
        width: 300,
      }}
    />
  );
};
