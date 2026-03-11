import {describe, expect, it} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import {renderWithTheme} from "../test-utils";
import {TableBoolean} from "./TableBoolean";

describe("TableBoolean", () => {
  it("renders correctly with true value", () => {
    const {toJSON} = renderWithTheme(<TableBoolean value={true} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders correctly with false value", () => {
    const {toJSON} = renderWithTheme(<TableBoolean value={false} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders check icon for true value", () => {
    const {toJSON} = renderWithTheme(<TableBoolean value={true} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders x icon for false value", () => {
    const {toJSON} = renderWithTheme(<TableBoolean value={false} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders editable checkbox when isEditing is true", () => {
    const {toJSON} = renderWithTheme(<TableBoolean isEditing value={true} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("toggles checkbox when pressed in editing mode", () => {
    const {toJSON, getByLabelText} = renderWithTheme(<TableBoolean isEditing value={false} />);
    const checkbox = getByLabelText("Checkbox is currently unchecked");
    fireEvent.press(checkbox);
    expect(toJSON()).toMatchSnapshot();
  });
});
