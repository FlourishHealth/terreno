import {describe, expect, it, mock} from "bun:test";
import {act, render} from "@testing-library/react-native";
import {createRef} from "react";

import type {ActionSheet} from "./ActionSheet";
import {DecimalRangeActionSheet} from "./DecimalRangeActionSheet";
import {ThemeProvider} from "./Theme";

describe("DecimalRangeActionSheet", () => {
  it("component is defined", () => {
    expect(DecimalRangeActionSheet).toBeDefined();
    expect(typeof DecimalRangeActionSheet).toBe("function");
  });

  it("renders correctly", () => {
    const actionSheetRef = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <DecimalRangeActionSheet
          actionSheetRef={actionSheetRef}
          max={10}
          min={0}
          onChange={() => {}}
          value="5.5"
        />
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with different min/max range", () => {
    const actionSheetRef = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <DecimalRangeActionSheet
          actionSheetRef={actionSheetRef}
          max={100}
          min={50}
          onChange={() => {}}
          value="75.3"
        />
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("invokes onChange when whole picker changes", () => {
    const actionSheetRef = createRef<ActionSheet>();
    const handleChange = mock((_val: string) => {});
    const {UNSAFE_getAllByProps} = render(
      <ThemeProvider>
        <DecimalRangeActionSheet
          actionSheetRef={actionSheetRef}
          max={10}
          min={0}
          onChange={handleChange}
          value="5.5"
        />
      </ThemeProvider>
    );
    // The first Picker is the whole number one (selectedValue: "5")
    const wholePickers = UNSAFE_getAllByProps({selectedValue: "5"});
    const whole = wholePickers.find((p) => typeof p.props.onValueChange === "function");
    act(() => {
      if (whole) {
        whole.props.onValueChange(7);
      }
    });
    expect(handleChange).toHaveBeenCalled();
  });

  it("invokes onChange when decimal picker changes", () => {
    const actionSheetRef = createRef<ActionSheet>();
    const handleChange = mock((_val: string) => {});
    const {UNSAFE_getAllByProps} = render(
      <ThemeProvider>
        <DecimalRangeActionSheet
          actionSheetRef={actionSheetRef}
          max={10}
          min={0}
          onChange={handleChange}
          value="5.5"
        />
      </ThemeProvider>
    );
    // The second Picker is the decimal one (selectedValue: "5")
    const decimalPickers = UNSAFE_getAllByProps({selectedValue: "5"});
    // Use the last one (second picker)
    const decimal = decimalPickers[decimalPickers.length - 1];
    act(() => {
      if (decimal && typeof decimal.props.onValueChange === "function") {
        decimal.props.onValueChange(3);
      }
    });
    expect(handleChange).toHaveBeenCalled();
  });
});
