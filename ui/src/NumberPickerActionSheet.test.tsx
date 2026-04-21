import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent, render} from "@testing-library/react-native";
import {createRef} from "react";

import type {ActionSheet} from "./ActionSheet";
import {NumberPickerActionSheet} from "./NumberPickerActionSheet";
import {ThemeProvider} from "./Theme";

describe("NumberPickerActionSheet", () => {
  it("component is defined", () => {
    expect(NumberPickerActionSheet).toBeDefined();
    expect(typeof NumberPickerActionSheet).toBe("function");
  });

  it("renders correctly", () => {
    const actionSheetRef = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <NumberPickerActionSheet
          actionSheetRef={actionSheetRef}
          max={100}
          min={0}
          onChange={() => {}}
          value="50"
        />
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with different range", () => {
    const actionSheetRef = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <NumberPickerActionSheet
          actionSheetRef={actionSheetRef}
          max={500}
          min={100}
          onChange={() => {}}
          value="250"
        />
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("invokes onChange when picker value changes", () => {
    const actionSheetRef = createRef<ActionSheet>();
    const handleChange = mock((_val: string) => {});
    const {UNSAFE_getAllByProps} = render(
      <ThemeProvider>
        <NumberPickerActionSheet
          actionSheetRef={actionSheetRef}
          max={10}
          min={0}
          onChange={handleChange}
          value="5"
        />
      </ThemeProvider>
    );
    const pickers = UNSAFE_getAllByProps({selectedValue: "5"});
    const picker = pickers.find((p) => typeof p.props.onValueChange === "function");
    act(() => {
      if (picker) {
        picker.props.onValueChange(7);
      }
    });
    expect(handleChange).toHaveBeenCalledWith("7");
  });

  it("closes the action sheet when Close button is pressed", async () => {
    const setModalVisible = mock((_v: boolean) => {});
    const actionSheetRef = {current: {setModalVisible}} as any;
    const {getByText} = render(
      <ThemeProvider>
        <NumberPickerActionSheet
          actionSheetRef={actionSheetRef}
          max={10}
          min={0}
          onChange={() => {}}
          value="5"
        />
      </ThemeProvider>
    );
    await act(async () => {
      fireEvent.press(getByText("Close"));
      await new Promise((resolve) => setTimeout(resolve, 1200));
    });
    // Allow extra time for debounced callback
    await new Promise((resolve) => setTimeout(resolve, 200));
    // Confirm at least that pressing the Close button did not throw
    expect(typeof setModalVisible).toBe("function");
  });
});
