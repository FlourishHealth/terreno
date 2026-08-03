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
    const handleChange = mock((_values: string[]) => {});
    const {getByLabelText} = renderWithTheme(
      <MultiselectField onChange={handleChange} options={defaultOptions} title="Title" value={[]} />
    );

    fireEvent.press(getByLabelText("Option B"));
    expect(handleChange).toHaveBeenCalledWith(["b"]);
  });

  // The whole row is the press target so the 16pt checkbox is not the only thing a user
  // can hit, which keeps each option at Apple's 44pt guidance without overlapping rows.
  it("uses the full row as a 44pt press target including the label", () => {
    const handleChange = mock((_values: string[]) => {});
    const {getByLabelText, getByText} = renderWithTheme(
      <MultiselectField onChange={handleChange} options={defaultOptions} title="Title" value={[]} />
    );

    const row = getByLabelText("Option B");
    const style = row.props.style as Record<string, unknown>;
    expect(style.minHeight).toBe(44);
    expect(row.props.hitSlop).toEqual({bottom: 2, top: 2});

    // The label lives inside the row, so it is part of the same target.
    expect(getByText("Option B")).toBeTruthy();
  });

  it("removes option when deselected", () => {
    const handleChange = mock((_values: string[]) => {});
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
