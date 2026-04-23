import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent, renderHook} from "@testing-library/react-native";

import {renderWithTheme} from "./test-utils";
import {useWebDropdownAnchor, WebDropdownMenu} from "./WebDropdownMenu";

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

  it("highlights the option matched by selectedIndex regardless of duplicated values", () => {
    const dupOptions = [
      {label: "Placeholder", value: ""},
      {label: "Blank option", value: ""},
      {label: "Real", value: "real"},
    ];
    const {getByText} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={dupOptions}
        selectedIndex={1}
        visible
      />
    );
    expect(getByText("Blank option").props.style.fontWeight).toBe("600");
    expect(getByText("Placeholder").props.style.fontWeight).toBe("400");
    expect(getByText("Real").props.style.fontWeight).toBe("400");
  });
});

describe("useWebDropdownAnchor", () => {
  it("exposes a default zero-sized anchor before measuring", () => {
    const {result} = renderHook(() => useWebDropdownAnchor());
    expect(result.current.anchor).toEqual({height: 0, width: 0, x: 0, y: 0});
    expect(result.current.triggerRef.current).toBeNull();
  });

  it("invokes the callback synchronously with the existing anchor when the ref is empty", () => {
    const {result} = renderHook(() => useWebDropdownAnchor());
    const onMeasured = mock(() => {});
    act(() => {
      result.current.measure(onMeasured);
    });
    expect(onMeasured).toHaveBeenCalledTimes(1);
    expect(onMeasured.mock.calls[0][0]).toEqual({height: 0, width: 0, x: 0, y: 0});
  });

  it("measures the trigger and updates anchor state when the ref has measureInWindow", () => {
    const {result} = renderHook(() => useWebDropdownAnchor());
    // Simulate a mounted native View by assigning a measureInWindow shim to the
    // ref. The hook does not care whether the node is a real View instance.
    const measureInWindow = mock(
      (cb: (x: number, y: number, w: number, h: number) => void) => {
        cb(10, 20, 100, 40);
      }
    );
    (result.current.triggerRef as {current: unknown}).current = {measureInWindow};
    const onMeasured = mock(() => {});
    act(() => {
      result.current.measure(onMeasured);
    });
    expect(measureInWindow).toHaveBeenCalledTimes(1);
    expect(onMeasured).toHaveBeenCalledTimes(1);
    expect(onMeasured.mock.calls[0][0]).toEqual({height: 40, width: 100, x: 10, y: 20});
    expect(result.current.anchor).toEqual({height: 40, width: 100, x: 10, y: 20});
  });
});
