import {Picker} from "@react-native-picker/picker";
import range from "lodash/range";
import React from "react";

import {ActionSheet} from "./ActionSheet";
import {Box} from "./Box";
import {Button} from "./Button";
import type {NumberPickerActionSheetProps} from "./Common";

const PICKER_HEIGHT = 104;

type NumberPickerActionSheetState = {};

export class NumberPickerActionSheet extends React.Component<
  NumberPickerActionSheetProps,
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
                text="Close"
              />
            </Box>
          </Box>
          <Picker
            itemStyle={{
              height: PICKER_HEIGHT,
            }}
            onValueChange={(itemValue) => this.props.onChange(String(itemValue))}
            selectedValue={String(this.props.value)}
            style={{
              backgroundColor: "#FFFFFF",
              height: PICKER_HEIGHT,
            }}
          >
            {range(this.props.min, this.props.max).map((n) => (
              <Picker.Item key={String(n)} label={String(n)} value={String(n)} />
            ))}
          </Picker>
        </Box>
      </ActionSheet>
    );
  }
}
