import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";
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
});
