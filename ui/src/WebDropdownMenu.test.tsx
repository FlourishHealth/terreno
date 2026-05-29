import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent, renderHook} from "@testing-library/react-native";
import {Dimensions} from "react-native";

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

  it("applies dynamic background via the Pressable style callback", () => {
    const {getByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={options}
        selectedValue="b"
        visible
      />
    );
    const optionPressable = getByTestId("web_dropdown_option_a");
    const styleFn = optionPressable.props.style;
    expect(typeof styleFn).toBe("function");
    const defaultStyle = styleFn({hovered: false, pressed: false});
    const hoveredStyle = styleFn({hovered: true, pressed: false});
    const pressedStyle = styleFn({hovered: false, pressed: true});
    expect(defaultStyle.paddingHorizontal).toBe(12);
    expect(defaultStyle.paddingVertical).toBe(10);
    expect(hoveredStyle.backgroundColor).toBeDefined();
    expect(pressedStyle.backgroundColor).toBeDefined();
  });
});

describe("WebDropdownMenu positioning", () => {
  const options = [
    {label: "Option A", value: "a"},
    {label: "Option B", value: "b"},
  ];

  it("positions the menu above the trigger when near the bottom of the screen", () => {
    // Window height is mocked to 812. Place the trigger near the bottom so
    // there is not enough room (< 300px) below it.
    const bottomAnchor = {height: 40, width: 200, x: 16, y: 750};
    const {getByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={bottomAnchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={options}
        searchable={false}
        visible
      />
    );
    const menu = getByTestId("web_dropdown_menu");
    const style = Array.isArray(menu.props.style)
      ? Object.assign({}, ...menu.props.style)
      : menu.props.style;
    // Menu should open above: bottom-anchored so it sits flush above the trigger.
    expect(style.bottom).toBe(812 - bottomAnchor.y + 4);
    expect(style.top).toBeUndefined();
  });

  it("positions the menu below the trigger when there is room below", () => {
    const topAnchor = {height: 40, width: 200, x: 16, y: 32};
    const {getByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={topAnchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={options}
        searchable={false}
        visible
      />
    );
    const menu = getByTestId("web_dropdown_menu");
    const style = Array.isArray(menu.props.style)
      ? Object.assign({}, ...menu.props.style)
      : menu.props.style;
    expect(style.top).toBe(topAnchor.y + topAnchor.height + 4);
    expect(style.bottom).toBeUndefined();
    expect(style.maxHeight).toBe(300);
  });

  it("clamps maxHeight to available space when opening above", () => {
    const originalGet = Dimensions.get;
    Dimensions.get = () => ({fontScale: 1, height: 400, scale: 1, width: 375});
    try {
      // windowHeight=400, anchor y=200 + height=40 + gap=4 => spaceBelow=156.
      // Opens above because 156 < 300 and 200 > 156.
      const midAnchor = {height: 40, width: 200, x: 16, y: 200};
      const {getByTestId} = renderWithTheme(
        <WebDropdownMenu
          anchor={midAnchor}
          onClose={() => {}}
          onSelect={() => {}}
          options={options}
          searchable={false}
          visible
        />
      );
      const menu = getByTestId("web_dropdown_menu");
      const style = Array.isArray(menu.props.style)
        ? Object.assign({}, ...menu.props.style)
        : menu.props.style;
      expect(style.bottom).toBe(400 - midAnchor.y + 4);
      expect(style.top).toBeUndefined();
      expect(style.maxHeight).toBe(midAnchor.y - 4);
    } finally {
      Dimensions.get = originalGet;
    }
  });
});

describe("WebDropdownMenu searchable", () => {
  const anchor = {height: 40, width: 200, x: 16, y: 32};
  const options = [
    {label: "Apple", value: "apple"},
    {label: "Banana", value: "banana"},
    {label: "Cherry", value: "cherry"},
    {label: "Avocado", value: "avocado"},
  ];

  it("renders a search input by default (searchable defaults to true)", () => {
    const {getByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={options}
        visible
      />
    );
    expect(getByTestId("web_dropdown_search")).toBeTruthy();
  });

  it("does not render a search input when searchable is false", () => {
    const {queryByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={options}
        searchable={false}
        visible
      />
    );
    expect(queryByTestId("web_dropdown_search")).toBeNull();
  });

  it("filters options by label when the user types in the search input", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={options}
        searchable
        visible
      />
    );

    fireEvent.changeText(getByTestId("web_dropdown_search"), "a");
    expect(getByTestId("web_dropdown_option_apple")).toBeTruthy();
    expect(getByTestId("web_dropdown_option_banana")).toBeTruthy();
    expect(getByTestId("web_dropdown_option_avocado")).toBeTruthy();
    expect(queryByTestId("web_dropdown_option_cherry")).toBeNull();
  });

  it("shows 'No matching options' when filter matches nothing", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={options}
        searchable
        visible
      />
    );

    fireEvent.changeText(getByTestId("web_dropdown_search"), "zzz");
    expect(getByTestId("web_dropdown_no_results")).toBeTruthy();
    expect(queryByTestId("web_dropdown_option_apple")).toBeNull();
  });

  it("reports the original index when selecting a filtered option", () => {
    const onSelect = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={onSelect}
        options={options}
        searchable
        visible
      />
    );

    fireEvent.changeText(getByTestId("web_dropdown_search"), "cherry");
    fireEvent.press(getByTestId("web_dropdown_option_cherry"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]).toEqual(["cherry", 2]);
  });

  it("performs case-insensitive filtering", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={options}
        searchable
        visible
      />
    );

    fireEvent.changeText(getByTestId("web_dropdown_search"), "BANANA");
    expect(getByTestId("web_dropdown_option_banana")).toBeTruthy();
    expect(queryByTestId("web_dropdown_option_apple")).toBeNull();
  });

  it("shows all options when search input is empty", () => {
    const {getByTestId} = renderWithTheme(
      <WebDropdownMenu
        anchor={anchor}
        onClose={() => {}}
        onSelect={() => {}}
        options={options}
        searchable
        visible
      />
    );

    fireEvent.changeText(getByTestId("web_dropdown_search"), "ban");
    fireEvent.changeText(getByTestId("web_dropdown_search"), "");
    expect(getByTestId("web_dropdown_option_apple")).toBeTruthy();
    expect(getByTestId("web_dropdown_option_banana")).toBeTruthy();
    expect(getByTestId("web_dropdown_option_cherry")).toBeTruthy();
    expect(getByTestId("web_dropdown_option_avocado")).toBeTruthy();
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
    const measureInWindow = mock((cb: (x: number, y: number, w: number, h: number) => void) => {
      cb(10, 20, 100, 40);
    });
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

  it("exercises the Pressable style callback for hover/pressed states", () => {
    const {root} = renderWithTheme(
      <WebDropdownMenu
        anchor={{height: 40, width: 100, x: 0, y: 50}}
        onClose={() => {}}
        onSelect={() => {}}
        options={[
          {label: "A", value: "a"},
          {label: "B", value: "b"},
        ]}
        visible
      />
    );
    // Find a Pressable with the style callback
    const pressables = root.findAll(
      (n) => typeof n.props.style === "function" && n.props["aria-role"] === "button"
    );
    expect(pressables.length).toBeGreaterThan(0);
    // Call the style function with different states to exercise all branches
    const styleFn = pressables[0].props.style;
    const normalStyle = styleFn({hovered: false, pressed: false});
    expect(normalStyle).toHaveProperty("paddingHorizontal");
    const hoveredStyle = styleFn({hovered: true, pressed: false});
    expect(hoveredStyle).toHaveProperty("paddingHorizontal");
    const pressedStyle = styleFn({hovered: false, pressed: true});
    expect(pressedStyle).toHaveProperty("paddingHorizontal");
  });
});
