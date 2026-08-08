import {describe, expect, it} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {renderWithTheme} from "../test-utils";
import {TableBadge} from "./TableBadge";

describe("TableBadge", () => {
  it("renders correctly with value", () => {
    const {toJSON} = renderWithTheme(<TableBadge value="Active" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders badge text", () => {
    const {getByText} = renderWithTheme(<TableBadge value="Pending" />);
    expect(getByText("Pending")).toBeTruthy();
  });

  it("renders with info status (default)", () => {
    const {toJSON} = renderWithTheme(<TableBadge value="Info" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with success status", () => {
    const {toJSON} = renderWithTheme(<TableBadge badgeStatus="success" value="Approved" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with warning status", () => {
    const {toJSON} = renderWithTheme(<TableBadge badgeStatus="warning" value="Review" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with error status", () => {
    const {toJSON} = renderWithTheme(<TableBadge badgeStatus="error" value="Rejected" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with icon", () => {
    const {toJSON} = renderWithTheme(
      <TableBadge badgeIconName="check" badgeStatus="success" value="Complete" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders select field when editing", () => {
    const editingOptions = [
      {label: "Option A", value: "a"},
      {label: "Option B", value: "b"},
    ];
    const {toJSON} = renderWithTheme(
      <TableBadge editingOptions={editingOptions} isEditing value="a" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders badge when editing is enabled but options are missing", () => {
    const {getByText, queryByTestId} = renderWithTheme(<TableBadge isEditing value="Pending" />);
    expect(getByText("Pending")).toBeTruthy();
    expect(queryByTestId("web_picker")).toBeNull();
  });

  it("updates selected value when select field changes to a non-empty option", async () => {
    const editingOptions = [
      {label: "Option A", value: "a"},
      {label: "Option B", value: "b"},
    ];
    const {getByTestId} = renderWithTheme(
      <TableBadge editingOptions={editingOptions} isEditing value="a" />
    );

    expect(getByTestId("text_input").props.children).toBe("Option A");
    await act(async () => {
      fireEvent.press(getByTestId("web_picker"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("web_dropdown_option_b"));
    });
    expect(getByTestId("text_input").props.children).toBe("Option B");
  });

  it("clears selected value when select field changes to an empty value", async () => {
    const editingOptions = [
      {label: "Option A", value: "a"},
      {label: "Option B", value: "b"},
    ];
    const {getByTestId} = renderWithTheme(
      <TableBadge editingOptions={editingOptions} isEditing value="a" />
    );

    await act(async () => {
      fireEvent.press(getByTestId("web_picker"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("web_dropdown_option_"));
    });
    expect(getByTestId("text_input").props.children).toBe("Please select an option.");
  });
});
