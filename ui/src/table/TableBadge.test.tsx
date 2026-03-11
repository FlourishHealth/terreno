import {describe, expect, it} from "bun:test";
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
});
