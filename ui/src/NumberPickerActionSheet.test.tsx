import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";
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
});
