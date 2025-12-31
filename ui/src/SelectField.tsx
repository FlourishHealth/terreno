import type {FC} from "react";
import {View} from "react-native";

import type {SelectFieldProps} from "./Common";
import {FieldError, FieldHelperText, FieldTitle} from "./fieldElements";
import {RNPickerSelect} from "./PickerSelect";

export const SelectField: FC<SelectFieldProps> = ({
  disabled = false,
  errorText,
  helperText,
  options,
  requireValue = false,
  placeholder = "Please select an option.",
  title,
  value,
  onChange,
}) => {
  const clearOption = {label: placeholder ?? "---", value: ""};

  return (
    <View>
      {title && <FieldTitle text={title} />}
      {Boolean(errorText) && <FieldError text={errorText!} />}
      <RNPickerSelect
        disabled={disabled}
        items={options}
        onValueChange={(v) => {
          if (v === undefined || v === "") {
            onChange("");
          } else {
            onChange(v);
          }
        }}
        placeholder={!requireValue ? clearOption : {}}
        value={value ?? ""}
      />
      {helperText && <FieldHelperText text={helperText} />}
    </View>
  );
};
