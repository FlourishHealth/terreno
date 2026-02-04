import {describe, expect, it, mock} from "bun:test";
import {forwardRef} from "react";
import {View} from "react-native";

import {Signature} from "./Signature";
import {renderWithTheme} from "./test-utils";

// Mock react-signature-canvas
mock.module("react-signature-canvas", () => ({
  default: forwardRef(({backgroundColor}: any, ref) => (
    <View ref={ref as any} style={{backgroundColor}} testID="signature-canvas" />
  )),
}));

describe("Signature", () => {
  it("renders correctly", () => {
    const mockOnChange = mock(() => {});
    const {toJSON} = renderWithTheme(<Signature onChange={mockOnChange} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("component is defined", () => {
    expect(Signature).toBeDefined();
    expect(typeof Signature).toBe("function");
  });

  it("renders with clear button", () => {
    const mockOnChange = mock(() => {});
    const {getByText} = renderWithTheme(<Signature onChange={mockOnChange} />);
    expect(getByText("Clear")).toBeTruthy();
  });
});
