import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {BooleanField} from "./BooleanField";
import {renderWithTheme} from "./test-utils";

describe("BooleanField", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<BooleanField onChange={() => {}} value={false} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with title", () => {
    const {getByText, toJSON} = renderWithTheme(
      <BooleanField onChange={() => {}} title="Enable notifications" value={false} />
    );
    expect(getByText("Enable notifications")).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with value true", () => {
    const {toJSON} = renderWithTheme(<BooleanField onChange={() => {}} value={true} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with title variant showing Yes/No text", () => {
    const {getByText} = renderWithTheme(
      <BooleanField onChange={() => {}} title="Active" value={true} variant="title" />
    );
    expect(getByText("Yes")).toBeTruthy();
  });

  it("renders with title variant showing No when false", () => {
    const {getByText} = renderWithTheme(
      <BooleanField onChange={() => {}} title="Active" value={false} variant="title" />
    );
    expect(getByText("No")).toBeTruthy();
  });

  it("calls onChange when pressed", () => {
    const handleChange = mock((_value: boolean) => {});
    const {UNSAFE_getByType} = renderWithTheme(
      <BooleanField onChange={handleChange} value={false} />
    );
    // TouchableWithoutFeedback is the pressable element
    const touchable = UNSAFE_getByType("TouchableWithoutFeedback" as any);
    fireEvent.press(touchable);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("does not call onChange when disabled", () => {
    const handleChange = mock((_value: boolean) => {});
    const {UNSAFE_getByType} = renderWithTheme(
      <BooleanField disabled onChange={handleChange} value={false} />
    );
    const touchable = UNSAFE_getByType("TouchableWithoutFeedback" as any);
    fireEvent.press(touchable);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("renders disabled state", () => {
    const {toJSON} = renderWithTheme(<BooleanField disabled onChange={() => {}} value={false} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with helper text", () => {
    const {getByText} = renderWithTheme(
      <BooleanField helperText="Toggle to enable" onChange={() => {}} value={false} />
    );
    expect(getByText("Toggle to enable")).toBeTruthy();
  });

  it("renders with disabled helper text when disabled", () => {
    const {getByText} = renderWithTheme(
      <BooleanField
        disabled
        disabledHelperText="This setting is locked"
        onChange={() => {}}
        value={false}
      />
    );
    expect(getByText("This setting is locked")).toBeTruthy();
  });
});
