import type {FC} from "react";
import {View} from "react-native";

import type {SelectFieldProps} from "./Common";
import {FieldError, FieldHelperText, FieldTitle} from "./fieldElements";
import {RNPickerSelect} from "./PickerSelect";
import {resolveFieldTestIdsFromProps} from "./testing/resolveTestId";

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
  testId,
  testID,
  testIds,
}) => {
  const clearOption = {label: placeholder ?? "---", value: ""};
  const fieldTestIds = resolveFieldTestIdsFromProps({testID, testId, testIds});

  return (
    <View style={{width: "100%"}} testID={fieldTestIds.input}>
      {Boolean(title) && <FieldTitle testID={fieldTestIds.label} text={title!} />}
      {Boolean(errorText) && <FieldError testID={fieldTestIds.error} text={errorText!} />}
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
        textInputProps={{testID: fieldTestIds.input}}
        value={value ?? ""}
      />
      {Boolean(helperText) && <FieldHelperText testID={fieldTestIds.helper} text={helperText!} />}
    </View>
  );
};
