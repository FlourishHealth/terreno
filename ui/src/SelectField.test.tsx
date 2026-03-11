import {describe, expect, it} from "bun:test";

import {SelectField} from "./SelectField";
import {renderWithTheme} from "./test-utils";

describe("SelectField", () => {
  const defaultOptions = [
    {label: "Option 1", value: "opt1"},
    {label: "Option 2", value: "opt2"},
    {label: "Option 3", value: "opt3"},
  ];

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(
      <SelectField onChange={() => {}} options={defaultOptions} value="" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with title", () => {
    const {getByText, toJSON} = renderWithTheme(
      <SelectField onChange={() => {}} options={defaultOptions} title="Select an option" value="" />
    );
    expect(getByText("Select an option")).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with helper text", () => {
    const {getByText} = renderWithTheme(
      <SelectField
        helperText="This is helper text"
        onChange={() => {}}
        options={defaultOptions}
        value=""
      />
    );
    expect(getByText("This is helper text")).toBeTruthy();
  });

  it("renders with error text", () => {
    const {getByText} = renderWithTheme(
      <SelectField
        errorText="This field is required"
        onChange={() => {}}
        options={defaultOptions}
        value=""
      />
    );
    expect(getByText("This field is required")).toBeTruthy();
  });

  it("renders with selected value", () => {
    const {toJSON} = renderWithTheme(
      <SelectField onChange={() => {}} options={defaultOptions} value="opt2" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom placeholder", () => {
    const {toJSON} = renderWithTheme(
      <SelectField
        onChange={() => {}}
        options={defaultOptions}
        placeholder="Choose one..."
        value=""
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders disabled state", () => {
    const {toJSON} = renderWithTheme(
      <SelectField disabled onChange={() => {}} options={defaultOptions} value="" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with requireValue (no clear option)", () => {
    const {toJSON} = renderWithTheme(
      <SelectField onChange={() => {}} options={defaultOptions} requireValue value="opt1" />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
