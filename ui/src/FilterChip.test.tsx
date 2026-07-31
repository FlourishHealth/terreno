import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {FilterChip} from "./FilterChip";
import {renderWithTheme} from "./test-utils";

const flattenStyle = (style: unknown): Record<string, unknown> => {
  const entries = Array.isArray(style) ? style : [style];
  return Object.assign({}, ...entries.filter(Boolean));
};

describe("FilterChip", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<FilterChip label="Status" value="Open" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders the label and value", () => {
    const {getByText} = renderWithTheme(<FilterChip label="Status" value="Open" />);
    expect(getByText("Status: ")).toBeTruthy();
    expect(getByText("Open")).toBeTruthy();
  });

  it("calls onDismiss when the dismiss button is pressed", () => {
    const onDismiss = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <FilterChip label="Status" onDismiss={onDismiss} testID="chip" value="Open" />
    );

    fireEvent.press(getByTestId("chip.dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("hides the dismiss button when no handler is given", () => {
    const {queryByTestId} = renderWithTheme(
      <FilterChip label="Status" testID="chip" value="Open" />
    );
    expect(queryByTestId("chip.dismiss")).toBeNull();
  });

  it("hides the dismiss button when disabled", () => {
    const onDismiss = mock(() => {});
    const {queryByTestId} = renderWithTheme(
      <FilterChip disabled label="Status" onDismiss={onDismiss} testID="chip" value="Open" />
    );
    expect(queryByTestId("chip.dismiss")).toBeNull();
  });

  // theme.text.extraLight and theme.surface.disabled are the same primitive (neutral500),
  // so pairing them once rendered the disabled chip's value as invisible grey-on-grey.
  it("keeps a disabled chip's value legible against its own background", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <FilterChip disabled label="Owner" testID="chip" value="Me" />
    );
    const chipStyle = flattenStyle(getByTestId("chip").props.style);
    const valueStyle = flattenStyle(getByText("Me").props.style);

    expect(chipStyle.backgroundColor).toBeTruthy();
    expect(valueStyle.color).toBeTruthy();
    expect(valueStyle.color).not.toBe(chipStyle.backgroundColor);
  });

  // A multiChoice filter renders sibling chips that share a label, so the value has to be in
  // the default accessible name or every dismiss button announces identically.
  it("names the dismiss button by label and value", () => {
    const {getByLabelText} = renderWithTheme(
      <FilterChip label="Tags" onDismiss={() => {}} value="Urgent" />
    );
    expect(getByLabelText("Remove Tags filter: Urgent")).toBeTruthy();
  });

  it("falls back to the label alone when there is no value", () => {
    const {getByLabelText} = renderWithTheme(<FilterChip label="Status" onDismiss={() => {}} />);
    expect(getByLabelText("Remove Status filter")).toBeTruthy();
  });

  it("accepts a custom dismiss accessibility label", () => {
    const {getByLabelText} = renderWithTheme(
      <FilterChip
        dismissAccessibilityLabel="Clear status"
        label="Status"
        onDismiss={() => {}}
        value="Open"
      />
    );
    expect(getByLabelText("Clear status")).toBeTruthy();
  });
});
