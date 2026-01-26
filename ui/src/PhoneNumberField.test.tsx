import {describe, expect, it, mock} from "bun:test";

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

  it("formats phone number as user types", () => {
    const handleChange = mock((value: string) => {});
    const {toJSON} = renderWithTheme(
      <PhoneNumberField label="Phone" onChange={handleChange} value="5551234567" />
    );
    // Snapshot captures the formatted phone number display
    expect(toJSON()).toMatchSnapshot();
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
});
