import {Picker} from "@react-native-picker/picker";
import range from "lodash/range";
import {useCallback, useState} from "react";
import {type StyleProp, type TextStyle} from "react-native";

import {ActionSheet} from "./ActionSheet";
import {Box} from "./Box";
import {Button} from "./Button";
import type {HeightActionSheetProps} from "./Common";
import {Heading} from "./Heading";
import {useTheme} from "./Theme";

const PICKER_HEIGHT = 180;

const inchesToFeetAndInches = (totalInches: string | undefined): {feet: string; inches: string} => {
  if (!totalInches) {
    return {feet: "", inches: ""};
  }

  const total = parseInt(totalInches, 10);
  if (Number.isNaN(total)) {
    return {feet: "", inches: ""};
  }

  return {
    feet: String(Math.floor(total / 12)),
    inches: String(total % 12),
  };
};

export const HeightActionSheet = ({
  actionSheetRef,
  onChange,
  value,
  min,
  max,
  title,
}: HeightActionSheetProps) => {
  const {theme} = useTheme();
  const {feet: initialFeet, inches: initialInches} = inchesToFeetAndInches(value);
  const [feet, setFeet] = useState(initialFeet);
  const [inches, setInches] = useState(initialInches);

  const minInches = min ?? 0;
  const maxInches = max ?? 95;
  const minFeet = Math.floor(minInches / 12);
  const maxFeet = Math.floor(maxInches / 12);

  const handleDoneClick = useCallback(() => {
    actionSheetRef?.current?.setModalVisible(false);
  }, [actionSheetRef]);

  const handleFeetChange = useCallback(
    (newFeet: string) => {
      setFeet(newFeet);
      onChange(String(Number(newFeet) * 12 + Number(inches)));
    },
    [inches, onChange]
  );

  const handleInchesChange = useCallback(
    (newInches: string) => {
      setInches(newInches);
      onChange(String(Number(feet) * 12 + Number(newInches)));
    },
    [feet, onChange]
  );

  const pickerItemStyle: StyleProp<TextStyle> = {
    color: theme.text.primary as string,
    fontSize: 20,
    height: PICKER_HEIGHT,
  };

  const pickerStyle = {
    backgroundColor: theme.surface.base,
    height: PICKER_HEIGHT,
  };

  return (
    <ActionSheet bounceOnOpen gestureEnabled ref={actionSheetRef}>
      <Box marginBottom={8} paddingX={4} width="100%">
        <Box alignItems="center" direction="row" justifyContent="between" width="100%">
          <Box flex="grow">{title ? <Heading size="md">{title}</Heading> : null}</Box>
          <Box width="33%">
            <Button onClick={handleDoneClick} text="Done" />
          </Box>
        </Box>
        <Box direction="row" width="100%">
          <Box width="50%">
            <Picker
              itemStyle={pickerItemStyle}
              onValueChange={handleFeetChange}
              selectedValue={feet}
              style={pickerStyle}
            >
              {range(minFeet, maxFeet + 1).map((n) => (
                <Picker.Item key={String(n)} label={`${String(n)} ft`} value={String(n)} />
              ))}
            </Picker>
          </Box>
          <Box width="50%">
            <Picker
              itemStyle={pickerItemStyle}
              onValueChange={handleInchesChange}
              selectedValue={inches}
              style={pickerStyle}
            >
              {range(0, 12).map((n) => (
                <Picker.Item key={String(n)} label={`${String(n)} in`} value={String(n)} />
              ))}
            </Picker>
          </Box>
        </Box>
      </Box>
    </ActionSheet>
  );
};
