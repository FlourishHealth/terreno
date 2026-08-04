import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {FilterBoolean} from "./FilterBoolean";
import {renderWithTheme} from "./test-utils";

describe("FilterBoolean", () => {
  const defaultProps = {
    onChange: () => {},
    title: "Urgent only",
    value: false,
  };

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<FilterBoolean {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders the title", () => {
    const {getByText} = renderWithTheme(<FilterBoolean {...defaultProps} />);
    expect(getByText("Urgent only")).toBeTruthy();
  });

  it("toggles when the entire row is pressed", () => {
    const onChange = mock();
    const {getByTestId} = renderWithTheme(
      <FilterBoolean {...defaultProps} onChange={onChange} testID="toggle" value={false} />
    );
    fireEvent.press(getByTestId("toggle"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not toggle when disabled", () => {
    const onChange = mock();
    const {getByTestId} = renderWithTheme(
      <FilterBoolean {...defaultProps} disabled onChange={onChange} testID="toggle" />
    );
    fireEvent.press(getByTestId("toggle"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the changes badge only when enabled", () => {
    const {queryByTestId, rerender} = renderWithTheme(
      <FilterBoolean {...defaultProps} testID="toggle" />
    );
    expect(queryByTestId("toggle.badge")).toBeNull();

    rerender(<FilterBoolean {...defaultProps} showChangesBadge testID="toggle" />);
    expect(queryByTestId("toggle.badge")).toBeTruthy();
  });
});
