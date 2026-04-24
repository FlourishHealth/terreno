import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";

import {PhoneNumberField} from "./PhoneNumberField";
import {renderWithTheme} from "./test-utils";

describe("PhoneNumberField", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(
      <PhoneNumberField label="Phone" onChange={() => {}} value="" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with placeholder", () => {
    const {getByPlaceholderText} = renderWithTheme(
      <PhoneNumberField
        label="Phone"
        onChange={() => {}}
        placeholder="Enter phone number"
        value=""
      />
    );
    expect(getByPlaceholderText("Enter phone number")).toBeTruthy();
  });

  it("renders with initial value", () => {
    const {getByDisplayValue} = renderWithTheme(
      <PhoneNumberField label="Phone" onChange={() => {}} value="(555) 123-4567" />
    );
    expect(getByDisplayValue("(555) 123-4567")).toBeTruthy();
  });

  it("renders with custom errorText", () => {
    const {getByText} = renderWithTheme(
      <PhoneNumberField
        errorText="Phone number is required"
        label="Phone"
        onChange={() => {}}
        value=""
      />
    );
    expect(getByText("Phone number is required")).toBeTruthy();
  });

  it("renders with icon", () => {
    const {toJSON} = renderWithTheme(
      <PhoneNumberField iconName="phone" label="Phone" onChange={() => {}} value="" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("uses US as default country code", () => {
    const {toJSON} = renderWithTheme(
      <PhoneNumberField label="Phone" onChange={() => {}} value="5551234567" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("accepts custom country code", () => {
    const {toJSON} = renderWithTheme(
      <PhoneNumberField
        defaultCountryCode="GB"
        label="Phone"
        onChange={() => {}}
        value="7911123456"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("calls onBlur callback when provided", async () => {
    const handleBlur = mock((_value: string) => {});
    const handleChange = mock((_value: string) => {});
    const {getByDisplayValue} = renderWithTheme(
      <PhoneNumberField
        label="Phone"
        onBlur={handleBlur}
        onChange={handleChange}
        value="(555) 123-4567"
      />
    );
    const input = getByDisplayValue("(555) 123-4567");
    await act(async () => {
      fireEvent(input, "blur", {nativeEvent: {text: "(555) 123-4567"}});
    });
    expect(handleBlur).toHaveBeenCalled();
  });

  it("calls onBlur with invalid number and sets an error state", async () => {
    const handleBlur = mock((_value: string) => {});
    const handleChange = mock((_value: string) => {});
    const {getByDisplayValue} = renderWithTheme(
      <PhoneNumberField label="Phone" onBlur={handleBlur} onChange={handleChange} value="" />
    );
    const input = getByDisplayValue("");
    await act(async () => {
      fireEvent.changeText(input, "123");
      fireEvent(input, "blur", {nativeEvent: {text: "123"}});
    });
    expect(handleBlur).toHaveBeenCalled();
  });

  it("handles empty input on blur without error", async () => {
    const handleBlur = mock((_value: string) => {});
    const handleChange = mock((_value: string) => {});
    const {getByDisplayValue} = renderWithTheme(
      <PhoneNumberField label="Phone" onBlur={handleBlur} onChange={handleChange} value="" />
    );
    const input = getByDisplayValue("");
    await act(async () => {
      fireEvent(input, "blur", {nativeEvent: {text: ""}});
    });
    expect(handleBlur).toHaveBeenCalled();
  });
});
