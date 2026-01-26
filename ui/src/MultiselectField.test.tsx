import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {MultiselectField} from "./MultiselectField";
import {renderWithTheme} from "./test-utils";

describe("MultiselectField", () => {
  const defaultOptions = [
    {label: "Option A", value: "a"},
    {label: "Option B", value: "b"},
    {label: "Option C", value: "c"},
  ];

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(
      <MultiselectField onChange={() => {}} options={defaultOptions} title="Select items" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders title correctly", () => {
    const {getByText} = renderWithTheme(
      <MultiselectField onChange={() => {}} options={defaultOptions} title="Choose options" />
    );
    expect(getByText("Choose options")).toBeTruthy();
  });

  it("renders all options", () => {
    const {getByText} = renderWithTheme(
      <MultiselectField onChange={() => {}} options={defaultOptions} title="Title" />
    );
    expect(getByText("Option A")).toBeTruthy();
    expect(getByText("Option B")).toBeTruthy();
    expect(getByText("Option C")).toBeTruthy();
  });

  it("shows selected options", () => {
    const {toJSON} = renderWithTheme(
      <MultiselectField
        onChange={() => {}}
        options={defaultOptions}
        title="Title"
        value={["a", "c"]}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("calls onChange when option is toggled", () => {
    const handleChange = mock((values: string[]) => {});
    const {getByLabelText} = renderWithTheme(
      <MultiselectField onChange={handleChange} options={defaultOptions} title="Title" value={[]} />
    );

    fireEvent.press(getByLabelText("Option B"));
    expect(handleChange).toHaveBeenCalledWith(["b"]);
  });

  it("removes option when deselected", () => {
    const handleChange = mock((values: string[]) => {});
    const {getByLabelText} = renderWithTheme(
      <MultiselectField
        onChange={handleChange}
        options={defaultOptions}
        title="Title"
        value={["a", "b"]}
      />
    );

    fireEvent.press(getByLabelText("Option A"));
    expect(handleChange).toHaveBeenCalledWith(["b"]);
  });

  it("renders with leftText variant (default)", () => {
    const {toJSON} = renderWithTheme(
      <MultiselectField
        onChange={() => {}}
        options={defaultOptions}
        title="Title"
        variant="leftText"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with rightText variant", () => {
    const {toJSON} = renderWithTheme(
      <MultiselectField
        onChange={() => {}}
        options={defaultOptions}
        title="Title"
        variant="rightText"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with error text", () => {
    const {getByText} = renderWithTheme(
      <MultiselectField
        errorText="Please select at least one option"
        onChange={() => {}}
        options={defaultOptions}
        title="Title"
      />
    );
    expect(getByText("Please select at least one option")).toBeTruthy();
  });

  it("renders with helper text", () => {
    const {getByText} = renderWithTheme(
      <MultiselectField
        helperText="Select all that apply"
        onChange={() => {}}
        options={defaultOptions}
        title="Title"
      />
    );
    expect(getByText("Select all that apply")).toBeTruthy();
  });

  it("renders disabled state", () => {
    const {toJSON} = renderWithTheme(
      <MultiselectField
        disabled
        onChange={() => {}}
        options={defaultOptions}
        title="Title"
        value={["a", "b"]}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
