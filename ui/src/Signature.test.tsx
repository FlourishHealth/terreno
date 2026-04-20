import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import {forwardRef, useImperativeHandle} from "react";
import {View} from "react-native";

import {Signature} from "./Signature";
import {renderWithTheme} from "./test-utils";

const clearMock = mock(() => {});
let toDataURLReturn: string = "";
const toDataURLMock = mock(() => toDataURLReturn);
let lastOnEnd: (() => void) | undefined;

// Mock react-signature-canvas so we can exercise the ref methods and onEnd callback.
mock.module("react-signature-canvas", () => ({
  default: forwardRef(({backgroundColor, onEnd}: any, ref) => {
    lastOnEnd = onEnd;
    useImperativeHandle(ref, () => ({
      clear: clearMock,
      toDataURL: toDataURLMock,
    }));
    return <View style={{backgroundColor}} testID="signature-canvas" />;
  }),
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

  it("calls clear on the signature canvas when Clear is pressed", () => {
    clearMock.mockClear();
    const mockOnChange = mock(() => {});
    const {getByText} = renderWithTheme(<Signature onChange={mockOnChange} />);
    fireEvent.press(getByText("Clear"));
    expect(clearMock).toHaveBeenCalledTimes(1);
  });

  it("calls onChange with the data URL when a stroke ends", () => {
    toDataURLReturn = "data:image/png;base64,abc";
    const mockOnChange = mock(() => {});
    renderWithTheme(<Signature onChange={mockOnChange} />);
    expect(lastOnEnd).toBeDefined();
    lastOnEnd?.();
    expect(mockOnChange).toHaveBeenCalledWith("data:image/png;base64,abc");
  });

  it("does not call onChange when toDataURL returns an empty value", () => {
    toDataURLReturn = "";
    const mockOnChange = mock(() => {});
    renderWithTheme(<Signature onChange={mockOnChange} />);
    expect(lastOnEnd).toBeDefined();
    lastOnEnd?.();
    expect(mockOnChange).not.toHaveBeenCalled();
  });
});
