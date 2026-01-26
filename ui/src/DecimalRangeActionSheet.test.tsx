import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";
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
});
