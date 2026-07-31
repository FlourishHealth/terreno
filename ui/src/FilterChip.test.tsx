import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {FilterChip} from "./FilterChip";
import {renderWithTheme} from "./test-utils";

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

  it("labels the dismiss button for screen readers", () => {
    const {getByLabelText} = renderWithTheme(
      <FilterChip label="Status" onDismiss={() => {}} value="Open" />
    );
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
