import {Picker} from "@react-native-picker/picker";
import range from "lodash/range";
import React from "react";

import {ActionSheet} from "./ActionSheet";
import {Box} from "./Box";
import {Button} from "./Button";
import type {DecimalRangeActionSheetProps, DecimalRangeActionSheetState} from "./Common";

const PICKER_HEIGHT = 104;

export class DecimalRangeActionSheet extends React.Component<
  DecimalRangeActionSheetProps,
  DecimalRangeActionSheetState
> {
  constructor(props: DecimalRangeActionSheetProps) {
    super(props);
    this.state = {
      decimal: String((Number(props.value) * 10) % 10),
      whole: String(Math.floor(Number(props.value))),
    };
  }

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
          <Box direction="row" width="100%">
            <Box width="50%">
              <Picker
                itemStyle={{
                  height: PICKER_HEIGHT,
                }}
                onValueChange={(whole) => {
                  this.setState({whole: String(whole)});
                  this.props.onChange(String(Number(whole) + Number(this.state.decimal) * 0.1));
                }}
                selectedValue={this.state.whole}
                style={{
                  backgroundColor: "#FFFFFF",
                  height: PICKER_HEIGHT,
                }}
              >
                {range(this.props.min, this.props.max + 1).map((n) => {
                  return <Picker.Item key={String(n)} label={String(n)} value={String(n)} />;
                })}
              </Picker>
            </Box>
            <Box width="50%">
              <Picker
                itemStyle={{
                  height: PICKER_HEIGHT,
                }}
                onValueChange={(decimal) => {
                  this.setState({decimal: String(decimal)});
                  this.props.onChange(String(Number(this.state.whole) + Number(decimal) * 0.1));
                }}
                selectedValue={this.state.decimal}
                style={{
                  backgroundColor: "#FFFFFF",
                  height: PICKER_HEIGHT,
                }}
              >
                {range(0, 10).map((n) => {
                  // console.log("N", n);
                  return <Picker.Item key={String(n)} label={`.${String(n)}`} value={String(n)} />;
                })}
              </Picker>
            </Box>
          </Box>
        </Box>
      </ActionSheet>
    );
  }
}
