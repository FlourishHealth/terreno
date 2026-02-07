import {describe, expect, it} from "bun:test";

import {CustomSelectField} from "./CustomSelectField";
import {renderWithTheme} from "./test-utils";

describe("CustomSelectField", () => {
  const defaultOptions = [
    {label: "Option A", value: "a"},
    {label: "Option B", value: "b"},
    {label: "Option C", value: "c"},
  ];

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(
      <CustomSelectField onChange={() => {}} options={defaultOptions} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with title", () => {
    const {getByText, toJSON} = renderWithTheme(
      <CustomSelectField onChange={() => {}} options={defaultOptions} title="Select Option" />
    );
    expect(getByText("Select Option")).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with placeholder", () => {
    const {toJSON} = renderWithTheme(
      <CustomSelectField onChange={() => {}} options={defaultOptions} placeholder="Choose one..." />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with selected value", () => {
    const {toJSON} = renderWithTheme(
      <CustomSelectField onChange={() => {}} options={defaultOptions} value="b" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom value (not in options)", () => {
    const {toJSON} = renderWithTheme(
      <CustomSelectField onChange={() => {}} options={defaultOptions} value="custom-value" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with error text", () => {
    const {getByText} = renderWithTheme(
      <CustomSelectField
        errorText="Please select an option"
        onChange={() => {}}
        options={defaultOptions}
      />
    );
    expect(getByText("Please select an option")).toBeTruthy();
  });

  it("renders with helper text", () => {
    const {getByText} = renderWithTheme(
      <CustomSelectField
        helperText="Select or enter a custom value"
        onChange={() => {}}
        options={defaultOptions}
      />
    );
    expect(getByText("Select or enter a custom value")).toBeTruthy();
  });

  it("renders disabled state", () => {
    const {toJSON} = renderWithTheme(
      <CustomSelectField disabled onChange={() => {}} options={defaultOptions} value="a" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("includes custom option in dropdown", () => {
    // The component automatically adds a "Custom" option to the options list
    const {toJSON} = renderWithTheme(
      <CustomSelectField onChange={() => {}} options={defaultOptions} />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
