import DateTimePicker, {type DateTimePickerEvent} from "@react-native-community/datetimepicker";
import {DateTime} from "luxon";
import React from "react";

import {ActionSheet} from "./ActionSheet";
import {Box} from "./Box";
import {Button} from "./Button";
import type {TextFieldPickerActionSheetProps} from "./Common";

type NumberPickerActionSheetState = {};

export class NumberPickerActionSheet extends React.Component<
  TextFieldPickerActionSheetProps,
  NumberPickerActionSheetState
> {
  render(): React.ReactElement {
    const parsedValue = this.props.value ? DateTime.fromISO(this.props.value) : undefined;
    const pickerValue =
      parsedValue?.isValid === true ? parsedValue.toJSDate() : DateTime.now().toJSDate();

    return (
      <ActionSheet bounceOnOpen gestureEnabled ref={this.props.actionSheetRef}>
        <Box marginBottom={8} paddingX={4} width="100%">
          <Box alignItems="end" display="flex" width="100%">
            <Box width="33%">
              <Button
                onClick={() => {
                  this.props.actionSheetRef?.current?.setModalVisible(false);
                }}
                text="Save"
              />
            </Box>
          </Box>
          <DateTimePicker
            display="spinner"
            is24Hour
            mode={this.props.mode}
            onChange={(_event: DateTimePickerEvent, date?: Date) => {
              if (!date) {
                return;
              }
              const iso = DateTime.fromJSDate(date).toUTC().toISO();
              if (!iso) {
                return;
              }
              this.props.onChange(iso);
            }}
            testID="dateTimePicker"
            value={pickerValue}
          />
        </Box>
      </ActionSheet>
    );
  }
}
