import DateTimePicker from "@react-native-community/datetimepicker";
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
  render() {
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
            onChange={(_event: any, date?: Date) => {
              if (!date) {
                return;
              }
              this.props.onChange(date.toString());
            }}
            testID="dateTimePicker"
            value={this.props.value ? new Date(this.props.value) : new Date()}
          />
        </Box>
      </ActionSheet>
    );
  }
}
