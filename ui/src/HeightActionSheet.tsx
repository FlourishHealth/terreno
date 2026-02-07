import {Picker} from "@react-native-picker/picker";
import range from "lodash/range";
import React from "react";

import {ActionSheet} from "./ActionSheet";
import {Box} from "./Box";
import {Button} from "./Button";
import type {HeightActionSheetProps} from "./Common";
import {Heading} from "./Heading";

const PICKER_HEIGHT = 180;

interface HeightActionSheetState {
  feet: string;
  inches: string;
}

export class HeightActionSheet extends React.Component<
  HeightActionSheetProps,
  HeightActionSheetState
> {
  constructor(props: HeightActionSheetProps) {
    super(props);
    this.state = {
      feet: String(Math.floor(Number(props.value) / 12)),
      inches: String(Number(props.value) % 12),
    };
  }

  render() {
    const minInches = this.props.min ?? 0;
    const maxInches = this.props.max ?? 95;
    const minFeet = Math.floor(minInches / 12);
    const maxFeet = Math.floor(maxInches / 12);

    return (
      <ActionSheet bounceOnOpen gestureEnabled ref={this.props.actionSheetRef}>
        <Box marginBottom={8} paddingX={4} width="100%">
          <Box alignItems="center" direction="row" justifyContent="between" width="100%">
            <Box flex="grow">
              {this.props.title ? (
                <Heading size="md">{this.props.title}</Heading>
              ) : null}
            </Box>
            <Box width="33%">
              <Button
                onClick={() => {
                  this.props.actionSheetRef?.current?.setModalVisible(false);
                }}
                text="Done"
              />
            </Box>
          </Box>
          <Box direction="row" width="100%">
            <Box width="50%">
              <Picker
                itemStyle={{
                  color: "#1a1a1a",
                  fontSize: 20,
                  height: PICKER_HEIGHT,
                }}
                onValueChange={(feet) => {
                  this.setState({feet: String(feet)});
                  this.props.onChange(String(Number(feet) * 12 + Number(this.state.inches)));
                }}
                selectedValue={this.state.feet}
                style={{
                  backgroundColor: "#FFFFFF",
                  height: PICKER_HEIGHT,
                }}
              >
                {range(minFeet, maxFeet + 1).map((n) => {
                  return (
                    <Picker.Item key={String(n)} label={`${String(n)} ft`} value={String(n)} />
                  );
                })}
              </Picker>
            </Box>
            <Box width="50%">
              <Picker
                itemStyle={{
                  color: "#1a1a1a",
                  fontSize: 20,
                  height: PICKER_HEIGHT,
                }}
                onValueChange={(inches) => {
                  this.setState({inches: String(inches)});
                  this.props.onChange(String(Number(this.state.feet) * 12 + Number(inches)));
                }}
                selectedValue={this.state.inches}
                style={{
                  backgroundColor: "#FFFFFF",
                  height: PICKER_HEIGHT,
                }}
              >
                {range(0, 12).map((n) => {
                  return (
                    <Picker.Item key={String(n)} label={`${String(n)} in`} value={String(n)} />
                  );
                })}
              </Picker>
            </Box>
          </Box>
        </Box>
      </ActionSheet>
    );
  }
}
