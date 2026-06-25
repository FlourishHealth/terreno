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
  searchable = true,
  title,
  value,
  onChange,
}) => {
  const clearOption = {label: placeholder ?? "---", value: ""};

  return (
    <View style={{minWidth: 0, width: "100%"}}>
      {Boolean(title) && <FieldTitle text={title!} />}
      {Boolean(errorText) && <FieldError text={errorText!} />}
      <View style={{alignSelf: "stretch", minWidth: 0, width: "100%"}}>
        <RNPickerSelect
          disabled={disabled}
          items={options}
          onValueChange={(v) => {
            if (v === undefined || v === null || v === "") {
              onChange("");
            } else {
              onChange(String(v));
            }
          }}
          placeholder={!requireValue ? clearOption : {}}
          searchable={searchable}
          value={value ?? ""}
        />
      </View>
      {Boolean(helperText) && <FieldHelperText text={helperText!} />}
    </View>
  );
};
