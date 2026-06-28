import type {FC} from "react";
import {View} from "react-native";

import type {SelectFieldProps} from "./Common";
import {FieldError, FieldHelperText, FieldTitle} from "./fieldElements";
import {RNPickerSelect} from "./PickerSelect";
import {resolveFieldTestIDsFromProps} from "./testing/resolveTestId";

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
  testID,
  testIDs,
}) => {
  const clearOption = {label: placeholder ?? "---", value: ""};
  const fieldTestIDs = resolveFieldTestIDsFromProps({testID, testIDs});

  return (
    <View style={{width: "100%"}}>
      {Boolean(title) && <FieldTitle testID={fieldTestIDs.label} text={title!} />}
      {Boolean(errorText) && <FieldError testID={fieldTestIDs.error} text={errorText!} />}
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
        textInputProps={{testID: fieldTestIDs.input}}
        value={value ?? ""}
      />
      {Boolean(helperText) && <FieldHelperText testID={fieldTestIDs.helper} text={helperText!} />}
    </View>
  );
};
