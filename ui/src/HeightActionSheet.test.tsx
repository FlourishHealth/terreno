import {describe, expect, it, mock} from "bun:test";
import {act, render} from "@testing-library/react-native";
import {createRef} from "react";

import type {ActionSheet} from "./ActionSheet";
import {HeightActionSheet} from "./HeightActionSheet";
import {ThemeProvider} from "./Theme";

describe("HeightActionSheet", () => {
  it("component is defined", () => {
    expect(HeightActionSheet).toBeDefined();
    expect(typeof HeightActionSheet).toBe("function");
  });

  it("renders correctly", () => {
    const actionSheetRef = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <HeightActionSheet actionSheetRef={actionSheetRef} onChange={() => {}} value="72" />
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with different height value", () => {
    const actionSheetRef = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <HeightActionSheet actionSheetRef={actionSheetRef} onChange={() => {}} value="65" />
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with title and min/max values", () => {
    const actionSheetRef = createRef<ActionSheet>();
    const {getByText} = render(
      <ThemeProvider>
        <HeightActionSheet
          actionSheetRef={actionSheetRef}
          max={84}
          min={36}
          onChange={() => {}}
          title="Select Height"
          value="60"
        />
      </ThemeProvider>
    );
    expect(getByText("Select Height")).toBeTruthy();
  });

  it("invokes onChange when feet picker changes", () => {
    const actionSheetRef = createRef<ActionSheet>();
    const handleChange = mock((_val: string) => {});
    const {UNSAFE_getAllByProps} = render(
      <ThemeProvider>
        <HeightActionSheet actionSheetRef={actionSheetRef} onChange={handleChange} value="72" />
      </ThemeProvider>
    );
    // feet picker has selectedValue "6" (72 / 12)
    const feetPickers = UNSAFE_getAllByProps({selectedValue: "6"});
    const feetPicker = feetPickers.find((p) => typeof p.props.onValueChange === "function");
    act(() => {
      if (feetPicker) {
        feetPicker.props.onValueChange(5);
      }
    });
    expect(handleChange).toHaveBeenCalled();
  });

  it("invokes onChange when inches picker changes", () => {
    const actionSheetRef = createRef<ActionSheet>();
    const handleChange = mock((_val: string) => {});
    const {UNSAFE_getAllByProps} = render(
      <ThemeProvider>
        <HeightActionSheet actionSheetRef={actionSheetRef} onChange={handleChange} value="73" />
      </ThemeProvider>
    );
    // inches picker has selectedValue "1" (73 % 12)
    const inchPickers = UNSAFE_getAllByProps({selectedValue: "1"});
    const inchPicker = inchPickers.find((p) => typeof p.props.onValueChange === "function");
    act(() => {
      if (inchPicker) {
        inchPicker.props.onValueChange(5);
      }
    });
    expect(handleChange).toHaveBeenCalled();
  });
});
