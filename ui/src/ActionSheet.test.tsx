import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";
import {createRef} from "react";
import {Text} from "react-native";

import {ActionSheet, getDeviceHeight, getElevation} from "./ActionSheet";
import {ThemeProvider} from "./Theme";

describe("ActionSheet", () => {
  it("component is defined", () => {
    expect(ActionSheet).toBeDefined();
    expect(typeof ActionSheet).toBe("function");
  });

  it("renders correctly", () => {
    const ref = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <ActionSheet ref={ref}>
          <Text>Test content</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom overlay color", () => {
    const ref = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <ActionSheet overlayColor="rgba(0,0,0,0.5)" ref={ref}>
          <Text>Content</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with gesture enabled", () => {
    const ref = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <ActionSheet gestureEnabled ref={ref}>
          <Text>Gesture content</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  describe("getDeviceHeight", () => {
    it("returns a number", () => {
      const height = getDeviceHeight(false);
      expect(typeof height).toBe("number");
      expect(height).toBeGreaterThan(0);
    });

    it("works with statusBarTranslucent true", () => {
      const height = getDeviceHeight(true);
      expect(typeof height).toBe("number");
      expect(height).toBeGreaterThan(0);
    });
  });

  describe("getElevation", () => {
    it("returns empty object for no elevation", () => {
      expect(getElevation()).toEqual({});
      expect(getElevation(0)).toEqual({});
    });

    it("returns elevation styles for positive elevation", () => {
      const result = getElevation(5);
      expect(result).toHaveProperty("elevation", 5);
      expect(result).toHaveProperty("boxShadow");
    });
  });
});
