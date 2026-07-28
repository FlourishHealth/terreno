import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React, {type ReactNode} from "react";

import type {SidebarNavigationItem} from "./Common";

interface MockChildrenProps {
  children?: ReactNode;
}

interface NavigatorState {
  index: number;
  routes: {key: string; name: string}[];
}

const navigate = mock((_route: string) => {});

let navigatorState: NavigatorState = {
  index: 0,
  routes: [
    {key: "home-key", name: "index"},
    {key: "settings-key", name: "settings"},
  ],
};
let descriptors: Record<string, {options: Record<string, unknown>}> = {};

// The global expo-router mock in bunSetup.ts has no Navigator.useContext, which
// SidebarNavigatorContent relies on. Re-mock it here as a superset.
mock.module("expo-router", () => {
  const Navigator = ({children, ...props}: MockChildrenProps) =>
    React.createElement("Navigator", props, children);
  Navigator.useContext = () => ({descriptors, navigation: {navigate}, state: navigatorState});
  return {
    Link: ({children, ...props}: MockChildrenProps) => React.createElement("Link", props, children),
    Navigator,
    router: {
      back: mock(() => {}),
      canGoBack: mock(() => true),
      navigate: mock(() => {}),
      push: mock(() => {}),
      replace: mock(() => {}),
    },
    Slot: ({children, ...props}: MockChildrenProps) => React.createElement("Slot", props, children),
    Stack: ({children, ...props}: MockChildrenProps) =>
      React.createElement("Stack", props, children),
    Tabs: ({children, ...props}: MockChildrenProps) => React.createElement("Tabs", props, children),
    useFocusEffect: mock(() => undefined),
    useLocalSearchParams: mock(() => ({})),
    useNavigation: mock(() => ({
      addListener: mock(() => () => undefined),
      goBack: mock(() => {}),
      navigate: mock(() => {}),
      setOptions: mock(() => {}),
    })),
    usePathname: mock(() => "/"),
    useRouter: mock(() => ({
      back: mock(() => {}),
      canGoBack: mock(() => true),
      navigate: mock(() => {}),
      push: mock(() => {}),
      replace: mock(() => {}),
    })),
    useSearchParams: mock(() => ({})),
    useSegments: mock(() => []),
  };
});

mock.module("expo-router/build/views/Screen", () => ({
  Screen: ({children}: MockChildrenProps) => React.createElement("Screen", {}, children),
}));

const {SidebarNavigation, SidebarNavigationPanel} = await import("./SidebarNavigation");
const {renderWithTheme} = await import("./test-utils");

const topItems: SidebarNavigationItem[] = [
  {iconName: "house", label: "Home", route: "index"},
  {badge: 5, badgeStatus: "warning", iconName: "bell", label: "Alerts", route: "alerts"},
  {badge: true, iconName: "envelope", label: "Messages", route: "messages"},
];

const bottomItems: SidebarNavigationItem[] = [
  {iconName: "gear", label: "Settings", route: "settings"},
];

/** Calls the web-only mouse handlers the panel spreads onto its rail View. */
const hoverPanel = (
  root: ReturnType<typeof renderWithTheme>,
  handler: "onMouseEnter" | "onMouseLeave"
): void => {
  const rail = root.UNSAFE_root.findAll(
    (node) => typeof node.props?.[handler] === "function" && node.props.onMouseEnter !== undefined
  )[0];
  act(() => {
    (rail.props as Record<string, () => void>)[handler]();
  });
};

/** The rail items style the Pressable with an array of [computed, itemStyle]. */
const itemBackgroundColor = (root: ReturnType<typeof renderWithTheme>, label: string): unknown => {
  const styles = root.getByLabelText(label).props.style as {backgroundColor?: unknown}[];
  return styles.find((style) => style?.backgroundColor !== undefined)?.backgroundColor;
};

describe("SidebarNavigationPanel", () => {
  it("renders top and bottom items with children", () => {
    const view = renderWithTheme(
      <SidebarNavigationPanel
        activeRoute="index"
        bottomItems={bottomItems}
        onNavigate={() => {}}
        topItems={topItems}
      >
        <React.Fragment />
      </SidebarNavigationPanel>
    );
    expect(view.getByLabelText("Home")).toBeTruthy();
    expect(view.getByLabelText("Alerts")).toBeTruthy();
    expect(view.getByLabelText("Settings")).toBeTruthy();
  });

  it("calls onNavigate with the pressed item route", () => {
    const onNavigate = mock((_route: string) => {});
    const view = renderWithTheme(
      <SidebarNavigationPanel
        activeRoute="index"
        bottomItems={bottomItems}
        onNavigate={onNavigate}
        topItems={topItems}
      />
    );
    fireEvent.press(view.getByLabelText("Settings"));
    expect(onNavigate).toHaveBeenCalledWith("settings");
  });

  it("shows item labels only while the rail is hovered", () => {
    const view = renderWithTheme(
      <SidebarNavigationPanel
        activeRoute="index"
        bottomItems={bottomItems}
        onNavigate={() => {}}
        topItems={topItems}
      />
    );
    expect(view.queryByText("Home")).toBeNull();

    hoverPanel(view, "onMouseEnter");
    expect(view.getByText("Home")).toBeTruthy();

    hoverPanel(view, "onMouseLeave");
    expect(view.queryByText("Home")).toBeNull();
  });

  it("applies hovered styling to an item on hover in and clears it on hover out", () => {
    const view = renderWithTheme(
      <SidebarNavigationPanel
        activeRoute="index"
        bottomItems={bottomItems}
        itemStyle={{marginVertical: 2}}
        onNavigate={() => {}}
        panelStyle={{borderRightWidth: 2}}
        topItems={topItems}
      />
    );
    const item = view.getByLabelText("Settings");
    const backgroundOf = (): unknown => itemBackgroundColor(view, "Settings");

    expect(backgroundOf()).toBe("transparent");
    fireEvent(item, "hoverIn");
    expect(backgroundOf()).not.toBe("transparent");
    fireEvent(item, "hoverOut");
    expect(backgroundOf()).toBe("transparent");
  });
});

describe("SidebarNavigation", () => {
  beforeEach(() => {
    navigate.mockClear();
    navigatorState = {
      index: 0,
      routes: [
        {key: "home-key", name: "index"},
        {key: "settings-key", name: "settings"},
      ],
    };
    descriptors = {};
  });

  it("exposes Screen for per-screen options", () => {
    expect(SidebarNavigation.Screen).toBeDefined();
  });

  it("navigates via the Navigator context and forwards onNavigate", () => {
    const onNavigate = mock((_route: string) => {});
    const view = renderWithTheme(
      <SidebarNavigation bottomItems={bottomItems} onNavigate={onNavigate} topItems={topItems} />
    );
    fireEvent.press(view.getByLabelText("Settings"));
    expect(navigate).toHaveBeenCalledWith("settings");
    expect(onNavigate).toHaveBeenCalledWith("settings");
  });

  it("renders no header when the active screen has no header options", () => {
    const view = renderWithTheme(
      <SidebarNavigation bottomItems={bottomItems} topItems={topItems} />
    );
    expect(view.queryByText("Dashboard")).toBeNull();
  });

  it("renders the header title and header slots from screen options", () => {
    descriptors = {
      "home-key": {
        options: {
          headerLeft: () => React.createElement("HeaderLeft", {testID: "header-left"}),
          headerRight: () => React.createElement("HeaderRight", {testID: "header-right"}),
          title: "Dashboard",
        },
      },
    };
    const view = renderWithTheme(
      <SidebarNavigation bottomItems={bottomItems} initialRouteName="index" topItems={topItems}>
        <SidebarNavigation.Screen name="index" />
      </SidebarNavigation>
    );
    expect(view.getByText("Dashboard")).toBeTruthy();
    expect(view.getByTestId("header-left")).toBeTruthy();
    expect(view.getByTestId("header-right")).toBeTruthy();
  });

  it("marks the active route from the navigator state", () => {
    navigatorState = {index: 1, routes: navigatorState.routes};
    const view = renderWithTheme(
      <SidebarNavigation bottomItems={bottomItems} topItems={topItems} />
    );
    expect(itemBackgroundColor(view, "Settings")).not.toBe("transparent");
  });
});
