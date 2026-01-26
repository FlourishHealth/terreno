import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {formatAddress, TapToEdit} from "./TapToEdit";
import {renderWithTheme} from "./test-utils";

describe("TapToEdit", () => {
  it("renders correctly with text value", () => {
    const {toJSON} = renderWithTheme(
      <TapToEdit setValue={() => {}} title="Name" value="John Doe" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("displays title and value", () => {
    const {getByText} = renderWithTheme(
      <TapToEdit setValue={() => {}} title="Email" value="test@example.com" />
    );
    expect(getByText("Email")).toBeTruthy();
    expect(getByText("test@example.com")).toBeTruthy();
  });

  it("renders non-editable when editable is false", () => {
    const {toJSON} = renderWithTheme(
      <TapToEdit editable={false} title="Read Only" value="Cannot edit this" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders edit icon when editable", () => {
    const {toJSON} = renderWithTheme(
      <TapToEdit editable setValue={() => {}} title="Editable Field" value="Click to edit" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("shows editing mode when isEditing is true", () => {
    const {toJSON} = renderWithTheme(
      <TapToEdit isEditing setValue={() => {}} title="Field" value="Editing..." />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("displays helper text when provided", () => {
    const {toJSON} = renderWithTheme(
      <TapToEdit
        helperText="Enter your full name"
        onlyShowHelperTextWhileEditing={false}
        setValue={() => {}}
        title="Name"
        value=""
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with boolean type showing Yes/No", () => {
    const {getByText} = renderWithTheme(
      <TapToEdit editable={false} title="Active" type="boolean" value={true} />
    );
    expect(getByText("Yes")).toBeTruthy();
  });

  it("renders with boolean type showing No when false", () => {
    const {getByText} = renderWithTheme(
      <TapToEdit editable={false} title="Active" type="boolean" value={false} />
    );
    expect(getByText("No")).toBeTruthy();
  });

  it("renders with transform function", () => {
    const {getByText} = renderWithTheme(
      <TapToEdit
        editable={false}
        title="Custom"
        transform={(val) => `Transformed: ${val}`}
        value="data"
      />
    );
    expect(getByText("Transformed: data")).toBeTruthy();
  });

  it("renders with textarea type", () => {
    const {toJSON} = renderWithTheme(
      <TapToEdit
        editable={false}
        title="Description"
        type="textarea"
        value="This is a long description that spans multiple lines."
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});

describe("formatAddress", () => {
  it("formats full address correctly", () => {
    const address = {
      address1: "123 Main St",
      address2: "Apt 4",
      city: "New York",
      state: "NY",
      zipcode: "10001",
    };
    const result = formatAddress(address);
    expect(result).toContain("123 Main St");
    expect(result).toContain("Apt 4");
    expect(result).toContain("New York");
    expect(result).toContain("NY");
    expect(result).toContain("10001");
  });

  it("formats address as string when asString is true", () => {
    const address = {
      address1: "123 Main St",
      city: "Boston",
      state: "MA",
      zipcode: "02101",
    };
    const result = formatAddress(address, true);
    expect(result).toContain(",");
    expect(result).not.toContain("\n");
  });

  it("handles partial address", () => {
    const address = {
      city: "Chicago",
      state: "IL",
    };
    const result = formatAddress(address);
    expect(result).toContain("Chicago");
    expect(result).toContain("IL");
  });

  it("includes county information when provided", () => {
    const address = {
      address1: "100 County Rd",
      city: "Rural Town",
      countyCode: "113",
      countyName: "Dallas County",
      state: "TX",
      zipcode: "75001",
    };
    const result = formatAddress(address);
    expect(result).toContain("Dallas County");
    expect(result).toContain("(113)");
  });
});
