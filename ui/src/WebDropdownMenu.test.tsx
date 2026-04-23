import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {renderWithTheme} from "./test-utils";
import {WebDropdownMenu} from "./WebDropdownMenu";

describe("WebDropdownMenu", () => {
  const anchor = {height: 40, width: 200, x: 16, y: 32};
  const options = [
    {label: "Option A", value: "a"},
    {label: "Option B", value: "b"},
    {label: "Option C", value: "c"},
  ];

  it("marks the underlying Modal hidden when not visible", () => {
    const {getByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={options}
        visible={false}
      />
    );
    expect(getByTestId("web_dropdown_modal").props.visible).toBe(false);
  });

  it("marks the underlying Modal visible when open", () => {
    const {getByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={options}
        visible
      />
    );
    expect(getByTestId("web_dropdown_modal").props.visible).toBe(true);
  });

  it("renders every option when visible", () => {
    const {getByText} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={options}
        selectedValue="b"
        visible
      />
    );
    expect(getByText("Option A")).toBeTruthy();
    expect(getByText("Option B")).toBeTruthy();
    expect(getByText("Option C")).toBeTruthy();
  });

  it("invokes onSelect with value and index when an option is pressed", () => {
    const onSelect = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={onSelect}
        options={options}
        visible
      />
    );
    fireEvent.press(getByTestId("web_dropdown_option_b"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]).toEqual(["b", 1]);
  });

  it("invokes onClose when the backdrop is pressed", () => {
    const onClose = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={onClose}
        onSelect={() => {}}
        options={options}
        visible
      />
    );
    fireEvent.press(getByTestId("web_dropdown_backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("anchors the menu below the trigger using the provided anchor", () => {
    const {getByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={options}
        visible
      />
    );
    const menu = getByTestId("web_dropdown_menu");
    const style = Array.isArray(menu.props.style)
      ? Object.assign({}, ...menu.props.style)
      : menu.props.style;
    expect(style.left).toBe(anchor.x);
    expect(style.top).toBe(anchor.y + anchor.height + 4);
    expect(style.width).toBe(anchor.width);
  });

  it("uses the custom testID prefix when provided", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={options}
        testIDPrefix="badge_menu"
        visible
      />
    );
    expect(getByTestId("badge_menu_menu")).toBeTruthy();
    expect(getByTestId("badge_menu_backdrop")).toBeTruthy();
    expect(getByTestId("badge_menu_option_a")).toBeTruthy();
    expect(queryByTestId("web_dropdown_menu")).toBeNull();
  });
});
