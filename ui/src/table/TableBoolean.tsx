import {type FC, useCallback, useState} from "react";
import {TouchableOpacity, View, type ViewStyle} from "react-native";

import {CheckBox} from "../CheckBox";
import type {TableBooleanProps} from "../Common";
import {Icon} from "../Icon";
import {useTheme} from "../Theme";

export interface TableBooleanHandles {
  handleSave: () => void | Promise<void>;
}

export const TableBoolean: FC<TableBooleanProps> = ({value, isEditing = false}) => {
  const [checked, setChecked] = useState(value);
  const {theme} = useTheme();
  const valueString = checked ? "checked" : "unchecked";
  const oppositeValueString = checked ? "unchecked" : "checked";

  const handlePress = useCallback(() => {
    setChecked(!checked);
  }, [checked]);

  if (isEditing) {
    return (
      <TouchableOpacity
        accessibilityHint={`Tap to change the checkbox from ${oppositeValueString} to ${valueString}`}
        aria-label={`Checkbox is currently ${valueString}`}
        aria-role="checkbox"
        hitSlop={{bottom: 10, left: 10, right: 10, top: 10}}
        onPress={handlePress}
        style={
          {
            alignItems: "center",
            justifyContent: "center",
          } as ViewStyle
        }
      >
        <CheckBox selected={checked} size="lg" />
      </TouchableOpacity>
    );
  } else {
    return (
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <View
          accessibilityHint={value ? "Checked icon" : "Unchecked icon"}
          aria-label={`The checkbox is ${valueString}`}
          aria-role="image"
          style={{
            alignItems: "center",
            backgroundColor: value ? theme.surface.successLight : "transparent",
            borderRadius: 16,
            height: 32,
            justifyContent: "center",
            width: 32,
          }}
        >
          <Icon color={value ? "success" : "error"} iconName={value ? "check" : "x"} />
        </View>
      </View>
    );
  }
};

TableBoolean.displayName = "TableBoolean";
