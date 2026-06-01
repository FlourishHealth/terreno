import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {Signature} from "./Signature";
import {renderWithTheme} from "./test-utils";

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

  it("notifies the parent with an empty value when Clear is pressed", () => {
    const mockOnChange = mock(() => {});
    const {getByText} = renderWithTheme(<Signature onChange={mockOnChange} />);
    fireEvent.press(getByText("Clear"));
    // Clearing the canvas emits no draw event, so the component must push ""
    // directly or "signature required" gating in parents would never reset.
    expect(mockOnChange).toHaveBeenCalledWith("");
  });
});
